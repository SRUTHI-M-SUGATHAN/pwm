/*
 * Password Management Servlets (PWM)
 * http://www.pwm-project.org
 *
 * Copyright (c) 2006-2009 Novell, Inc.
 * Copyright (c) 2009-2021 The PWM Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

var PWM_GLOBAL = PWM_GLOBAL || {};
var PWM_MAIN = PWM_MAIN || {};
var PWM_VAR = PWM_VAR || {};
var PWM_API = PWM_API || {};

PWM_API.formatDate = function(dateObj) {
    return PWM_MAIN.TimestampHandler.formatDate(dateObj);
};

PWM_MAIN.ajaxTimeout = 60 * 1000;

PWM_MAIN.pageLoadHandler = function() {
    PWM_GLOBAL['localeBundle'] = PWM_GLOBAL['localeBundle'] || [];
    PWM_GLOBAL['url-context'] = PWM_MAIN.getObject('application-info').getAttribute('data-url-context');
    PWM_GLOBAL['pwmFormID'] = PWM_MAIN.getObject('application-info').getAttribute('data-pwmFormID');
    PWM_GLOBAL['clientEtag'] = PWM_MAIN.getObject('application-info').getAttribute('data-clientEtag');

    var finishInitCounter = 0;
    var initFunctions = [];

    var completeFunction = function () {
        finishInitCounter++;
        if ( finishInitCounter === initFunctions.length ) {
            PWM_MAIN.initPage();
        }
    };

    initFunctions.push(function () {
        PWM_MAIN.loadClientData(completeFunction);
    });
    if (typeof PWM_CONFIG !== 'undefined') {
        PWM_GLOBAL['localeBundle'].push('Config');
    }
    if (typeof PWM_SETTINGS !== 'undefined' && typeof PWM_CFGEDIT !== 'undefined') {
        initFunctions.push(function () {
            PWM_CFGEDIT.initConfigSettingsDefinition(completeFunction);
        });
    }
    if (typeof PWM_ADMIN !== 'undefined') {
        PWM_GLOBAL['localeBundle'].push('Admin');

        initFunctions.push(function () {
            PWM_ADMIN.initAdminPage(completeFunction);
        });
    }
    {
        var seenBundles = [];
        PWM_GLOBAL['localeBundle'].push('Display');
        PWM_MAIN.JSLibrary.forEachInArray(PWM_GLOBAL['localeBundle'], function (bundleName) {
            if (!PWM_MAIN.JSLibrary.arrayContains(seenBundles, bundleName)) {
                initFunctions.push(function () {
                    PWM_MAIN.loadLocaleBundle(bundleName, completeFunction);
                });
            }
        });
    }

    PWM_MAIN.JSLibrary.forEachInArray(initFunctions,function(initFunction){
        initFunction();
    });
};

PWM_MAIN.loadClientData=function(completeFunction) {
    PWM_GLOBAL['app-data-client-retry-count'] = PWM_GLOBAL['app-data-client-retry-count'] + 1;
    var url = PWM_GLOBAL['url-context'] + "/public/api?processAction=clientData&etag=" + PWM_GLOBAL['clientEtag'];
    url = PWM_MAIN.addParamToUrl(url,'pageUrl',window.location.href);
    var loadFunction = function(data) {
        PWM_MAIN.JSLibrary.forEachInObject(data['data']['PWM_GLOBAL'],function(key,value){
            PWM_GLOBAL[key] = value;
        })
        PWM_MAIN.log('loaded client data');
        if (completeFunction) completeFunction();
    };
    var errorFunction = function(error) {
        var errorMsg = 'unable to read app-data: ' + error;;
        PWM_MAIN.log(errorMsg);
        if (!PWM_VAR['initError']) PWM_VAR['initError'] = errorMsg;
        if (completeFunction) completeFunction();
    };
    PWM_MAIN.ajaxRequest(url, loadFunction, {errorFunction:errorFunction,method:'GET',preventCache:false,addPwmFormID:false});
};

PWM_MAIN.loadLocaleBundle = function(bundleName, completeFunction) {
    var clientConfigUrl = PWM_GLOBAL['url-context'] + "/public/api?processAction=strings&bundle=" + bundleName;
    clientConfigUrl = PWM_MAIN.addParamToUrl(clientConfigUrl,'etag',PWM_GLOBAL['clientEtag']);
    var loadFunction = function(data){
        if (data['error'] === true) {
            console.error('unable to load locale bundle from ' + clientConfigUrl + ', error: ' + data['errorDetail'])
        } else {
            PWM_GLOBAL['localeStrings'] = PWM_GLOBAL['localeStrings'] || {};
            PWM_GLOBAL['localeStrings'][bundleName] = {};
            for (var settingKey in data['data']) {
                PWM_GLOBAL['localeStrings'][bundleName][settingKey] = data['data'][settingKey];
            }
        }
        PWM_MAIN.log('loaded locale bundle data for ' + bundleName);
        if (completeFunction) completeFunction();
    };
    var errorFunction = function(){
        var errorMsg = 'unable to load locale bundle from , please reload page (' + error + ')';
        PWM_MAIN.log(errorMsg);
        if (!PWM_VAR['initError']) PWM_VAR['initError'] = errorMsg;
        if (completeFunction) completeFunction();
    };
    PWM_MAIN.ajaxRequest(clientConfigUrl,loadFunction,{errorFunction:errorFunction,method:'GET',preventCache:false,addPwmFormID:false});
};

PWM_MAIN.initPage = function() {
    PWM_MAIN.applyFormAttributes();
    PWM_MAIN.initDisplayTabPreferences();

    document.body.setAttribute( 'data-browserType', PWM_GLOBAL['browserType']);

    PWM_MAIN.addEventHandler(document, "keypress", function (event) {
        PWM_MAIN.checkForCapsLock(event);
    });

    PWM_MAIN.doQuery('.pwm-link-print',function(element){
        PWM_MAIN.addEventHandler(element, "click", function(){ window.print(); });
    });

    if (PWM_MAIN.getObject('ldapProfile')) {
        PWM_MAIN.addEventHandler('ldapProfile', 'click', function () {
            PWM_MAIN.updateLoginContexts()
        });
    }

    PWM_MAIN.addEventHandler('icon-configModeHelp','click',function(){
        PWM_MAIN.showDialog({title:'Notice - Configuration Mode',text:PWM_MAIN.showString('Display_ConfigOpenInfo',{bundle:'Config'})});
    });

    if (PWM_GLOBAL['applicationMode'] === 'CONFIGURATION') {
        var configModeNoticeSeen = PWM_MAIN.Preferences.readSessionStorage('configModeNoticeSeen');
        if (!configModeNoticeSeen) {
            PWM_MAIN.Preferences.writeSessionStorage('configModeNoticeSeen',true);
            PWM_MAIN.showDialog({title:'Notice - Configuration Mode',text:PWM_MAIN.showString('Display_ConfigOpenInfo',{bundle:'Config'})});
        }
    }

    if (PWM_GLOBAL['pageLeaveNotice'] > 0) {
        PWM_MAIN.addEventHandler(document, "beforeunload", function(){
            var url = PWM_GLOBAL['url-command'] + "?processAction=pageLeaveNotice&pwmFormID=" + PWM_GLOBAL['pwmFormID'];
            PWM_MAIN.ajaxRequest(url,function(){},{preventCache:true});
        });
    }

    if (PWM_MAIN.getObject('message')) {
        PWM_GLOBAL['message_originalStyle'] = PWM_MAIN.getObject('message').style;
        PWM_MAIN.addEventHandler(window, "resize", function(){ PWM_MAIN.messageDivFloatHandler() });
        PWM_MAIN.addEventHandler(window, "scroll", function(){ PWM_MAIN.messageDivFloatHandler() });
    }

    if (PWM_GLOBAL['enableIdleTimeout']) {
        PWM_MAIN.IdleTimeoutHandler.initCountDownTimer(PWM_GLOBAL['MaxInactiveInterval']);
    }
    PWM_MAIN.initLocaleSelectorMenu('localeSelectionMenu');

    if (PWM_MAIN.getObject('LogoutButton')) {
        PWM_MAIN.showTooltip({
            id: 'LogoutButton',
            position: ['below', 'above'],
            text: PWM_MAIN.showString("Long_Title_Logout"),
            width: 500
        });
    }

    PWM_MAIN.JSLibrary.onPageLoad(function(){
        PWM_MAIN.JSLibrary.forEachInArray(PWM_GLOBAL['startupFunctions'],function(startupFunction){
            try {
                startupFunction();
            } catch(e) {
                console.error('error executing startup function: ' + e);
            }
        })
    });

    PWM_MAIN.TimestampHandler.initAllElements();

    ShowHidePasswordHandler.initAllForms();
    PWM_MAIN.log('initPage completed');
};

PWM_MAIN.initDisplayTabPreferences = function() {
    var storageName = 'lastTabState-' + window.location.pathname + '-';
    var knownTabNames = [];
    PWM_MAIN.doQuery('div.tab-container>input[type="radio"]',function(formElement) {
        var name = formElement.name;
        var id = formElement.id;
        if (!PWM_MAIN.JSLibrary.arrayContains(knownTabNames,name)) {
            knownTabNames.push(name);
        }
        PWM_MAIN.addEventHandler(formElement, 'click', function(){
            PWM_MAIN.Preferences.writeSessionStorage(storageName + name, id);
        });

    });

    knownTabNames.forEach(function(name){
        var value = PWM_MAIN.Preferences.readSessionStorage(storageName + name);
        if (value) {
            var selector = "input[name='" + name + "'][type='radio'][id='" + value + "']";
            PWM_MAIN.doQuery(selector,function(formElement){
                formElement.checked = true;
            });
        }
    });
};


PWM_MAIN.applyFormAttributes = function() {
    PWM_MAIN.doQuery('form',function(formElement) {
        formElement.setAttribute('autocomplete', 'off');

        //ios/webkit
        formElement.setAttribute('autocapitalize', 'none');
        formElement.setAttribute('autocorrect', 'off');
    });

    PWM_MAIN.doQuery('.pwm-form:not(.pwm-form-captcha)',function(formElement) {
        PWM_MAIN.addEventHandler(formElement, "submit", function(event){
            PWM_MAIN.handleFormSubmit(formElement, event);
        });
    });

    PWM_MAIN.doQuery('a:not([target])',function(linkElement) {
        try {
            if (linkElement.classList.contains('pwm-basic-link')) {
                return;
            }
        } catch (e) { /* ignore for browsers that don't support classList */ }
        var hrefValue = linkElement.getAttribute('href');
        if (hrefValue && hrefValue.charAt(0) !== '#') {
            PWM_MAIN.addEventHandler(linkElement, "click", function (event) {
                console.log('intercepted anchor click event');
                event.preventDefault();
                PWM_MAIN.showWaitDialog({loadFunction: function () {
                        PWM_MAIN.gotoUrl(hrefValue);
                    }});
            });
            linkElement.removeAttribute('href');
        }
    });

    // handle html5 form attribute in JS in case browser (IE) doesn't support it.
    if(PWM_MAIN.isIE()){
        PWM_MAIN.doQuery("button[type=submit][form]",function(element){
            PWM_MAIN.log('added IE event handler for submit button with form attribute ' + element.id);
            PWM_MAIN.addEventHandler(element,'click',function(e){
                e.preventDefault();
                PWM_MAIN.log('IE event handler intercepted submit for referenced form attribute ' + element.id);
                var formID = element.getAttribute('form');
                PWM_MAIN.handleFormSubmit(PWM_MAIN.getObject(formID));
            });
        });
    }
};

PWM_MAIN.isIE = function() {
    var browserType = document.body.getAttribute('data-browserType');
    return browserType && "ie" === browserType.toLowerCase();
}

PWM_MAIN.preloadAll = function(nextFunction) {
    if (!PWM_MAIN.html5DialogSupport()) {
        if (!PWM_MAIN.getObject('css-nihilo')) {
            PWM_MAIN.log('adding nihilo to body class css');
            document.body.classList.add("nihilo");
            PWM_MAIN.addCssClass()
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = PWM_GLOBAL['url-context'] + '/public/resources/webjars/dijit/themes/nihilo/nihilo.css';
            link.id = 'css-nihilo'
            document.getElementsByTagName('HEAD')[0].appendChild(link);
        }

        require(["dijit/Dialog"], function () {
            if (nextFunction) { nextFunction(); }
        });
    } else {
        if (nextFunction) { nextFunction(); }
    }
};

PWM_MAIN.showString = function (key, options) {
    options = options === undefined ? {} : options;
    var bundle = ('bundle' in options) ? options['bundle'] : 'Display';
    PWM_GLOBAL['localeStrings'] = PWM_GLOBAL['localeStrings'] || {};
    if (!PWM_GLOBAL['localeStrings'][bundle]) {
        return "UNDEFINED BUNDLE: " + bundle;
    }
    if (PWM_GLOBAL['localeStrings'][bundle][key]) {
        var returnStr = PWM_GLOBAL['localeStrings'][bundle][key];
        for (var i = 0; i < 10; i++) {
            if (options['value' + i]) {
                returnStr = returnStr.replace('%' + i + '%',options['value' + i]);
            }
        }
        return returnStr;
    } else {
        return "UNDEFINED STRING-" + key;
    }
};

PWM_MAIN.addEventHandler = function(nodeId,events,theFunction) {
    var element = PWM_MAIN.getObject(nodeId);
    if (element && events) {
        var eventArray = Array.isArray(events) ? events : events.split(',');
        PWM_MAIN.JSLibrary.forEachInArray(eventArray,function(event){
            if (element.addEventListener){
                element.addEventListener(event, theFunction, false);
            } else if (element.attachEvent){
                element.attachEvent('on'+event, theFunction);
            }
        });
    }
};

PWM_MAIN.addOneTimeEventHandler = function(nodeId,events,theFunctions) {
    var oneTimeFunction = function() {
        element.removeEventListener(events, oneTimeFunction);
        theFunctions();
    }
    PWM_MAIN.addEventHandler(nodeId,events,oneTimeFunction)
};


PWM_MAIN.gotoUrl = function(url, options) {
    options = options === undefined ? {} : options;
    if (!('noContext' in options) && url.indexOf(PWM_GLOBAL['url-context']) !== 0) {
        if (url.substring(0,1) === '/') {
            url = PWM_GLOBAL['url-context'] + url;
        }
    }

    if ('addFormID' in options) {
        if (url.indexOf('pwmFormID') === -1) {
            url = PWM_MAIN.addPwmFormIDtoURL(url);
        }
    }

    var executeGoto = function() {
        if (options['delay']) {
            setTimeout(function () {
                PWM_MAIN.log('redirecting to new url: ' + url);
                window.location = url;
            }, options['delay']);
        } else {
            PWM_MAIN.log('redirecting to new url: ' + url);
            window.location = url;
        }
    };

    var hideDialog = options['hideDialog'] = true;
    if (hideDialog) {
        executeGoto();
    } else {
        PWM_MAIN.showWaitDialog({loadFunction:function () {
                executeGoto();
            }});
    }
};


PWM_MAIN.handleLoginFormSubmit = function(form, event) {
    PWM_MAIN.log('entering handleLoginFormSubmit');
    PWM_MAIN.cancelEvent(event);

    PWM_MAIN.showWaitDialog({loadFunction: function () {
            var options = {};
            options['content'] = PWM_MAIN.JSLibrary.formToValueMap(form);
            delete options['content']['processAction'];
            delete options['content']['pwmFormID'];
            var url = 'login?processAction=restLogin';
            if (options['content']['skipCaptcha'])
            {
                PWM_MAIN.addParamToUrl( url, 'skipCaptcha', options['content']['skipCaptcha']);
            }
            var loadFunction = function(data) {
                if (data['error'] === true) {
                    PWM_MAIN.getObject('password').value = '';
                    PWM_MAIN.showErrorDialog(data,{
                        okAction:function(){
                            setTimeout(function(){
                                PWM_MAIN.getObject('password').focus();
                            },50);
                        }
                    });
                    return;
                }
                PWM_MAIN.log('authentication success');
                var nextURL = data['data']['nextURL'];
                if (nextURL) {
                    PWM_MAIN.gotoUrl(nextURL, {noContext: true});
                }
            };
            PWM_MAIN.ajaxRequest(url,loadFunction,options);
            if(typeof grecaptcha !== 'undefined'){
                try {
                    grecaptcha.reset(); // reset the
                } catch (e) {
                    PWM_MAIN.log("error resetting the captcha: " + e)
                }
            }
        }});
};

PWM_MAIN.log = function(text) {
    console.log(text);
};


PWM_MAIN.handleFormSubmit = function(form, event) {
    PWM_MAIN.log('entering handleFormSubmit');
    PWM_MAIN.cancelEvent(event);

    PWM_GLOBAL['idle_suspendTimeout'] = true;
    if ( form.elements ) {
        var formElements = form.elements;
        for (var i = 0; i < formElements.length; i++) {
            formElements[i].readOnly = true;
            if (formElements[i].type === 'button' || formElements[i].type === 'submit') {
                formElements[i].disabled = true;
            }
        }
    }

    PWM_MAIN.showWaitDialog({loadFunction:function(){
            form.submit();
        }});
    return false;
};


PWM_MAIN.checkForCapsLock = function(e) {
    var capsLockWarningElement = PWM_MAIN.getObject('capslockwarning');
    if (capsLockWarningElement === null || capsLockWarningElement === undefined) {
        return;
    }

    var capsLockKeyDetected = false;
    {
        var elementTarget = null;
        if (e.target) {
            elementTarget = e.target;
        } else if (e.srcElement) {
            elementTarget = e.srcElement;
        }
        if (elementTarget) {
            if (elementTarget.nodeName === 'input' || elementTarget.nodeName === 'INPUT') {
                var kc = e.keyCode ? e.keyCode : e.which;
                var sk = e.shiftKey ? e.shiftKey : ((kc === 16));
                if (((kc >= 65 && kc <= 90) && !sk) || ((kc >= 97 && kc <= 122) && sk)) {
                    capsLockKeyDetected = true;
                }
            }
        }
    }

    var displayDuration = 5 * 1000;
    if (capsLockKeyDetected) {
        PWM_MAIN.removeCssClass('capslockwarning','display-none');
        PWM_GLOBAL['lastCapsLockErrorTime'] = (new Date().getTime());
        setTimeout(function(){
            if ((new Date().getTime() - PWM_GLOBAL['lastCapsLockErrorTime'] > displayDuration)) {
                PWM_MAIN.addCssClass('capslockwarning','display-none');
            }
        },displayDuration + 500);
    } else {
        PWM_MAIN.addCssClass('capslockwarning','display-none');
    }
};

PWM_MAIN.getObject = function(name) {
    if (name === null || name === undefined) {
        return null;
    }

    if (name.tagName) {  // argument is already a dom element
        return name;
    }

    if (name === document || name === window) {
        return name;
    }

    var ns4 = document.layers;
    var w3c = document.getElementById;
    var ie4 = document.all;

    if (ns4) {
        return eval('document.' + name);
    }
    if (w3c) {
        return document.getElementById(name);
    }
    if (ie4) {
        return eval('document.all.' + name);
    }
    return false;
};

PWM_MAIN.trimString = function(sInString) {
    sInString = sInString.replace(/^\s+/g, "");
    // strip leading
    return sInString.replace(/\s+$/g, "");
    // strip trailing
};

PWM_MAIN.showDijitTooltip = function(options){
    options = options === undefined ? {} : options;

    if (!options['id']) {
        return;
    }

    var id = options['id'] instanceof Array ? options['id'] : [options['id']];
    var position = options['position'] instanceof Array ? options['position'] : null;

    var dojoOptions = {};
    dojoOptions['connectId'] = id;
    dojoOptions['id'] = id[0];
    dojoOptions['label'] = 'text' in options ? options['text'] : "missing text option";

    if (position) {
        dojoOptions['position'] = position;
    }

    if (options['width']) {
        dojoOptions['label'] = '<div style="max-width:' + options['width'] + 'px">' + dojoOptions['label'] + '</div>'
    }

    require(["dijit/Tooltip","dijit/registry"],function(Tooltip){
        PWM_MAIN.clearDijitWidget(id[0]);
        new Tooltip(dojoOptions);
    });
};

PWM_MAIN.showTooltip = function(options){
    options = options === undefined ? {} : options;

    if (!options['id']) {
        return;
    }

    var id = options['id'] instanceof Array ? options['id'] : [options['id']];

    var dojoOptions = {};
    dojoOptions['connectId'] = id;
    dojoOptions['id'] = id[0];

    var label = 'text' in options ? options['text'] : "missing text option for id " + id;

    var element = PWM_MAIN.getObject(id);
    if (element) {
        element.setAttribute('title',label);
    }
};



PWM_MAIN.clearDijitWidget = function (widgetName) {
    require(["dojo","dijit/registry"],function(dojo, registry){

        var oldDijitNode = registry.byId(widgetName);
        if (oldDijitNode) {
            try {
                oldDijitNode.destroyRecursive();
            } catch (error) {
                PWM_MAIN.log('error destroying old widget: ' + error);
            }

            try {
                oldDijitNode.destroy();
            } catch (error) {
                PWM_MAIN.log('error destroying old widget: ' + error);
            }
        }
    });
};

PWM_MAIN.showLocaleSelectionMenu = function(nextFunction, options) {
    options = options === undefined ? {} : options;
    var excludeLocales = 'excludeLocales' in options ? options['excludeLocales'] : [];

    var localeData = PWM_GLOBAL['localeInfo'];

    var bodyHtml = '<table class="noborder" style="width:auto;margin-right:auto;margin-left:auto;overflow-x:scroll">';
    PWM_MAIN.JSLibrary.forEachInObject(localeData, function (localeKey, loopDisplayName) {
        if (!PWM_MAIN.JSLibrary.arrayContains(excludeLocales, localeKey)) {
            var flagCode = PWM_GLOBAL['localeFlags'][localeKey];
            var flagUrl = PWM_GLOBAL['url-resources'] + '/webjars/famfamfam-flags/dist/png/' + flagCode + '.png';
            bodyHtml += '<tr style="cursor:pointer" id="locale-row-' + localeKey + '">';
            bodyHtml += '<td><img alt="Flag Image" src="' + flagUrl + '"/></td>';
            bodyHtml += '<td>' + loopDisplayName + '</td>';
            bodyHtml += '</tr>';
        }
    });
    bodyHtml += '</table>';

    PWM_MAIN.showDialog({
        showClose: true,
        showOk: false,
        text: bodyHtml,
        title: PWM_MAIN.showString('Title_LocaleSelect'),
        loadFunction: function () {
            PWM_MAIN.JSLibrary.forEachInObject(localeData, function (localeKey, loopDisplayName) {
                PWM_MAIN.addEventHandler('locale-row-' + localeKey, 'click', function () {
                    PWM_MAIN.closeWaitDialog();
                    nextFunction(localeKey);
                });
            });
        }
    });
};

PWM_MAIN.initLocaleSelectorMenu = function(attachNode) {
    PWM_MAIN.addEventHandler(attachNode,'click',function(){
        PWM_MAIN.showLocaleSelectionMenu(function(localeKey){
            PWM_MAIN.showWaitDialog({loadFunction:function(){
                    var url = PWM_GLOBAL['url-context'] + '/public/api?locale=' + localeKey;
                    PWM_MAIN.ajaxRequest(url, function(){
                        try {
                            var newLocation = window.location;
                            var searchParams = new URLSearchParams(newLocation.search);
                            if ( searchParams.has('locale')) {
                                searchParams.set('locale', localeKey);
                                newLocation.search = searchParams.toString();
                                window.location = newLocation;
                                return;
                            }
                        } catch (e) {
                            PWM_MAIN.log('error replacing locale parameter on existing url: ' + e);
                        }

                        window.location.reload(true);
                    });
                }
            });
        });
    });
};



PWM_MAIN.showErrorDialog = function(error, options) {
    options = options === undefined ? {} : options;
    var forceReload = false;
    var body = '';
    var logMsg = '';
    var titleMsg = PWM_MAIN.showString('Title_Error');
    if ('text' in options) {
        body += options['text'];
        body += '<br/><br/>';
        logMsg += options['text'];
    }
    if (error && error['error']) {
        var code = error['errorCode'];
        if (code === 5028 || code === 5034 || code === 5035) {
            forceReload = true;
        }
        titleMsg += ' ' + error['errorCode'];
        body += error['errorMessage'];
        logMsg += error['errorCode'] + "," + error['errorMessage'];
        if (error['errorDetail']) {
            body += "<br/><br/><div class='errorDetail' style='max-height: 250px; overflow-y: auto'>" + error['errorDetail'] + '</div>';
            logMsg += ", detail: " + error['errorDetail'];
        }
    } else {
        body += error;
        logMsg += error;
    }

    if (forceReload) {
        logMsg += 'due to error code type, reloading page.';
    }

    PWM_MAIN.log('displaying error message: ' + logMsg);
    options['title'] = titleMsg;
    options['text'] = body;
    var previousOkAction = 'okAction' in options ? options['okAction'] : function() {};
    options['okAction'] =  function() {
        if (forceReload) { // incorrect page sequence;
            var newURL = window.location.pathname;
            PWM_MAIN.gotoUrl(newURL);
            PWM_MAIN.showWaitDialog();
        } else {
            previousOkAction();
        }
    };
    PWM_MAIN.showDialog(options);
};

PWM_MAIN.showWaitDialog = function(options) {
    PWM_MAIN.closeWaitDialog();

    options = options || {};
    options['title'] = options['title'] || '';
    var progressBar = options['progressBar'];

    var waitOverlayDiv = document.createElement('div');
    waitOverlayDiv.setAttribute('id','wait-overlay');
    document.body.appendChild(waitOverlayDiv);

    var htmlContent = '<span>' + options['title'] + '</span>';
    htmlContent += progressBar
        ? '<progress value="-1" id="wait-progress"/>'
        : '<div id="wait-overlay-inner"></div>';

    var waitOverlayMessage = document.createElement('div');
    waitOverlayMessage.setAttribute('id','wait-overlay-message');
    waitOverlayMessage.innerHTML = htmlContent;
    document.body.appendChild(waitOverlayMessage);

    if ('loadFunction' in options) {
        options.loadFunction();
    }
};

PWM_MAIN.closeWaitDialog = function(idName) {

    var html5Mode = PWM_MAIN.html5DialogSupport();
    if (html5Mode) {
        if (PWM_MAIN.getObject('html5Dialog')) {
            PWM_MAIN.getObject('html5Dialog').parentNode.removeChild(PWM_MAIN.getObject('html5Dialog'));
        }
    } else {
        idName = idName === undefined ? 'dialogPopup' : idName;
        PWM_MAIN.clearDijitWidget(idName);
    }

    PWM_MAIN.JSLibrary.removeElementFromDom('wait-overlay');
    PWM_MAIN.JSLibrary.removeElementFromDom('wait-overlay-message');
};

PWM_MAIN.html5DialogSupport = function() {
    if (PWM_GLOBAL['client.js.enableHtml5Dialog']) {
        var testdialog = document.createElement("dialog");
        testdialog.setAttribute("open", "");
        return (testdialog.open === true);
    }
    return false;
};

PWM_MAIN.showDialog = function(options) {
    PWM_MAIN.closeWaitDialog();
    var html5Dialog = PWM_MAIN.html5DialogSupport();

    options = options === undefined ? {} : options;
    var title = options['title'] || 'DialogTitle';
    var text = 'text' in options ? options['text'] : 'DialogBody';
    var closeOnOk = 'closeOnOk' in options ? options['closeOnOk'] : true;
    var showOk = 'showOk' in options ? options['showOk'] : true;
    var showCancel = 'showCancel' in options ? options['showCancel'] : false;
    var showClose = 'showClose' in options ? options['showClose'] : false;
    var allowMove = 'allowMove' in options ? options['allowMove'] : false;
    var idName = 'id' in options ? options['id'] : 'dialogPopup';
    var dialogClass = 'dialogClass' in options ? options['dialogClass'] : null;
    var dojoStyle = 'dojoStyle' in options ? options['dojoStyle'] : null;
    var okLabel = 'okLabel' in options ? options['okLabel'] : PWM_MAIN.showString('Button_OK');
    var buttonHtml = 'buttonHtml' in options ? options['buttonHtml'] : '';
    var href = 'href' in options ? options['href'] : null;

    var okAction = function(){
        if (closeOnOk) {
            PWM_MAIN.closeWaitDialog(idName);
        }
        if ('okAction' in options) {
            options['okAction']();
        } else {
            PWM_MAIN.log('dialog okAction is empty')
        }
    };
    var cancelAction = 'cancelAction' in options ? options['cancelAction'] : function(){
        PWM_MAIN.closeWaitDialog(idName);
        PWM_MAIN.log('no-dialog-cancelaction')
    };
    var loadFunction = 'loadFunction' in options ? options['loadFunction'] : function(){
        PWM_MAIN.log('no-dialog-loadfunction')
    };

    PWM_VAR['dialog_loadFunction'] = loadFunction;

    var bodyText = '';
    bodyText += text;

    if (showOk || showCancel || buttonHtml.length > 0) {
        bodyText += '<div class="buttonbar">';
        if (showOk) {
            bodyText += '<button class="btn" id="dialog_ok_button">'
                + '<span class="btn-icon pwm-icon pwm-icon-check-square-o"></span>'
                + okLabel + '</button>  ';
        }
        if (showCancel) {
            bodyText += '<button class="btn" id="dialog_cancel_button">'
                + '<span class="btn-icon pwm-icon pwm-icon-times"></span>'
                + PWM_MAIN.showString('Button_Cancel') + '</button>  ';
        }
        bodyText += buttonHtml;
        bodyText += '</div>';
    }

    var dialogClassText = 'dialogBody';
    if (dialogClass) {
        dialogClassText += ' ' + dialogClass;
    }
    bodyText = '<div class="' + dialogClassText + '">' + bodyText + '</div>';

    if (html5Dialog) {
        var doDialogDisplay = function(){
            PWM_MAIN.closeWaitDialog();
            var dialogElement = document.createElement("dialog");
            dialogElement.setAttribute("id", 'html5Dialog');
            var html5DialogHtml = '<div class="titleBar">' + title;
            if (showClose) {
                html5DialogHtml += '<div id="icon-closeDialog" class="closeIcon pwm-icon pwm-icon-times"></div>'
            }
            html5DialogHtml += '</div><div class="body">' + bodyText + '</div>';
            dialogElement.innerHTML = html5DialogHtml;
            document.body.appendChild(dialogElement);
            dialogElement.showModal();

            setTimeout(function () {
                if (showOk) {
                    PWM_MAIN.addEventHandler('dialog_ok_button', 'click', function () {
                        okAction()
                    });
                }
                if (showClose) {
                    PWM_MAIN.addEventHandler('icon-closeDialog', 'click', function () {
                        PWM_MAIN.closeWaitDialog();
                    });
                }

                if (showCancel) {
                    PWM_MAIN.addEventHandler('dialog_cancel_button', 'click', function () {
                        cancelAction()
                    });
                }
                setTimeout(loadFunction, 100);
            }, 100);
        }

        if (href) {
            var hrefContentHandler = function( value ) {
                bodyText = '<div class="' + dialogClassText + '">' + value + '</div>';
                doDialogDisplay();
            };
            PWM_MAIN.showWaitDialog({loadFunction:function(){
                    PWM_MAIN.ajaxRequest(href,hrefContentHandler,{method:'GET',responseMimeType:'text/html',handleAs:'html'});
                }});
        } else {
            doDialogDisplay();
        }
    } else {
        PWM_MAIN.preloadAll();
        require(["dojo", "dijit/Dialog"], function (dojo, Dialog) {
            PWM_MAIN.clearDijitWidget(idName);
            var theDialog = new Dialog({
                id: idName,
                closable: showClose,
                draggable: allowMove,
                title: title,
                style: dojoStyle,
                content: bodyText,
                href: href
            });
            if (!showClose) {
                dojo.style(theDialog.closeButtonNode, "display", "none");
            }
            dojo.connect(theDialog, "onShow", null, function () {
                if (showOk) {
                    PWM_MAIN.addEventHandler('dialog_ok_button', 'click', function () {
                        okAction()
                    });
                }
                if (showCancel) {
                    PWM_MAIN.addEventHandler('dialog_cancel_button', 'click', function () {
                        cancelAction()
                    });
                }
                setTimeout(loadFunction, 100);
            });
            theDialog.show();
        });
    }
};

PWM_MAIN.showEula = function(requireAgreement, agreeFunction) {
    if (agreeFunction && PWM_GLOBAL['eulaAgreed']) {
        agreeFunction();
        return;
    }

    var displayEula = function (data) {
        PWM_GLOBAL['dialog_agreeAction'] = agreeFunction ? agreeFunction : function(){};

        var bodyText = '<div style="height: 400px; overflow: auto" class="eulaText">' + data + '</div>';

        var dialogOptions = {};
        dialogOptions['text'] = bodyText;
        dialogOptions['title'] = 'End User License Agreement';

        if (requireAgreement) {
            dialogOptions['showCancel'] = true;
            dialogOptions['okLabel'] = PWM_MAIN.showString('Button_Agree');
            dialogOptions['okAction'] = function() {
                PWM_GLOBAL['eulaAgreed']=true;
                agreeFunction();
            };
        }

        PWM_MAIN.showDialog(dialogOptions);
    };

    var eulaLocation = PWM_GLOBAL['url-resources'] + '/text/eula.txt';

    var options = {};
    options['method'] = 'GET';
    options['handleAs'] = 'text';
    var loadFunction = function (data) {
        displayEula(data);
    };
    PWM_MAIN.ajaxRequest(eulaLocation, loadFunction, options);
};

PWM_MAIN.showConfirmDialog = function(options) {
    options = options === undefined ? {} : options;
    options['showCancel'] = true;
    options['title'] = 'title' in options ? options['title'] : PWM_MAIN.showString('Button_Confirm');
    options['text'] = 'text' in options ? options['text'] : PWM_MAIN.showString('Confirm');
    PWM_MAIN.showDialog(options);
};

PWM_MAIN.clearError=function() {
    PWM_GLOBAL['messageStatus'] = '';
    PWM_MAIN.doShow('messageStatus','\u00a0');
};

PWM_MAIN.showInfo=function(infoMsg) {
    PWM_GLOBAL['messageStatus'] = 'message-info';
    PWM_MAIN.doShow('message-info',infoMsg);
};

PWM_MAIN.showError=function(errorMsg) {
    PWM_GLOBAL['messageStatus'] = 'message-error';
    PWM_MAIN.doShow('message-error',errorMsg);
};

PWM_MAIN.showSuccess=function(successMsg) {
    PWM_GLOBAL['messageStatus'] = 'message-success';
    PWM_MAIN.doShow('message-success',successMsg);
};

PWM_MAIN.doShow = function(destClass, message, fromFloatHandler) {
    var messageElement = PWM_MAIN.getObject("message");
    if (messageElement === null || messageElement.firstChild === null || messageElement.firstChild.nodeValue === null) {
        return;
    }

    // clear existing status
    PWM_MAIN.removeCssClass(messageElement,'message-info');
    PWM_MAIN.removeCssClass(messageElement,'message-error');
    PWM_MAIN.removeCssClass(messageElement,'message-success');

    if (destClass === '') {
        PWM_MAIN.addCssClass(messageElement, "nodisplay")
        return;
    } else {
        PWM_MAIN.removeCssClass(messageElement, "nodisplay")
    }

    messageElement.firstChild.nodeValue = message;

    PWM_MAIN.addCssClass(messageElement,destClass);

    if (!fromFloatHandler) {
        PWM_MAIN.messageDivFloatHandler();
    }
};

PWM_MAIN.createCSSClass = function(selector, style) {
    // using information found at: http://www.quirksmode.org/dom/w3c_css.html
    // doesn't work in older versions of Opera (< 9) due to lack of styleSheets support
    if(!document.styleSheets) return;
    if(document.getElementsByTagName("head").length === 0) return;
    var styleSheet;
    var mediaType;
    if(document.styleSheets.length > 0)
    {
        for(var i = 0; i<document.styleSheets.length; i++)
        {
            if(document.styleSheets[i].disabled) continue;
            var media = document.styleSheets[i].media;
            mediaType = typeof media;
            // IE
            if(mediaType === "string")
            {
                if(media === "" || media.indexOf("screen") !== -1)
                {
                    styleSheet = document.styleSheets[i];
                }
            }
            else if(mediaType === "object")
            {
                try {
                    if(media.mediaText === "" || media.mediaText.indexOf("screen") !== -1)
                    {
                        styleSheet = document.styleSheets[i];
                    }
                } catch (e) { /* noop */ }
            }
            // stylesheet found, so break out of loop
            if(typeof styleSheet !== "undefined") break;
        }
    }
    // if no style sheet is found
    if(typeof styleSheet === "undefined")
    {
        // create a new style sheet
        var styleSheetElement = document.createElement("style");
        styleSheetElement.type = "text/css";
        // add to <head>
        document.getElementsByTagName("head")[0].appendChild(styleSheetElement);
        // select it
        for(i = 0; i<document.styleSheets.length; i++)
        {
            if(document.styleSheets[i].disabled) continue;
            styleSheet = document.styleSheets[i];
        }
        // read media type
        var media = styleSheet.media;
        mediaType = typeof media;
    }
    // IE
    if(mediaType === "string")
    {
        for(i = 0;i<styleSheet.rules.length;i++)
        {
            // if there is an existing rule set up, replace it
            try {
                if(styleSheet.cssRules[i].selectorText && styleSheet.rules[i].selectorText.toLowerCase() === selector.toLowerCase())
                {
                    styleSheet.rules[i].style.cssText = style;
                    return;
                }
            } catch (e) {
                PWM_MAIN.log('error while checking existing rules during cssCreate:' + e);
            }
        }
        // or add a new rule
        styleSheet.addRule(selector,style);
    }
    else if(mediaType === "object")
    {
        for(i = 0;i<styleSheet.cssRules.length;i++)
        {
            // if there is an existing rule set up, replace it
            if(styleSheet.cssRules[i].selectorText && styleSheet.cssRules[i].selectorText.toLowerCase() === selector.toLowerCase())
            {
                styleSheet.cssRules[i].style.cssText = style;
                return;
            }
        }
        // or insert new rule
        styleSheet.insertRule(selector + "{" + style + "}", styleSheet.cssRules.length);
    }
};

PWM_MAIN.flashDomElement = function(flashColor,elementName,durationMS) {
    var element = PWM_MAIN.getObject(elementName);
    if ( element ) {
        PWM_MAIN.addCssClass(element,'background-alert-flash');
        setTimeout(function(){
            //      PWM_MAIN.removeCssClass(element, 'background-alert-flash');
        },5000)
    }
};

PWM_MAIN.getRenderedStyle = function(el,styleProp) {
    var x = document.getElementById(el);
    if (x.currentStyle) {
        return x.currentStyle[styleProp];
    }

    if (window.getComputedStyle) {
        return document.defaultView.getComputedStyle(x,null).getPropertyValue(styleProp);
    }

    return null;
};

PWM_MAIN.elementInViewport = function(el, includeWidth) {
    var top = el.offsetTop;
    var left = el.offsetLeft;
    var width = el.offsetWidth;
    var height = el.offsetHeight;

    while(el.offsetParent) {
        el = el.offsetParent;
        top += el.offsetTop;
        left += el.offsetLeft;
    }

    var pageY = (typeof(window.pageYOffset)=='number') ? window.pageYOffset : document.documentElement.scrollTop;
    var pageX = (typeof(window.pageXOffset)=='number') ? window.pageXOffset : document.documentElement.scrollLeft;

    return includeWidth ? (
        top >= pageY && (top + height) <= (pageY + window.innerHeight) &&
        left >= pageX &&
        (left + width) <= (pageX + window.innerWidth)
    ) : (
        top >= pageY && (top + height) <= (pageY + window.innerHeight)
    );
};

PWM_MAIN.messageDivFloatHandler = function() {
    var messageObj = PWM_MAIN.getObject('message');
    var messageWrapperObj = PWM_MAIN.getObject('message_wrapper');
    if (!messageObj || !messageWrapperObj) {
        return;
    }

    if (PWM_MAIN.hasCssClass('message','nodisplay')) {
        return;
    }

    var doFloatDisplay = !(PWM_MAIN.elementInViewport(messageWrapperObj,false) || PWM_GLOBAL['messageStatus'] === '');

    if (PWM_GLOBAL['message_scrollToggle'] !== doFloatDisplay) {
        PWM_GLOBAL['message_scrollToggle'] = doFloatDisplay;

        if (doFloatDisplay) {
            PWM_MAIN.addCssClass(messageObj,'message-scrollFloat');
            PWM_MAIN.doShow(PWM_GLOBAL['messageStatus'],messageObj.innerHTML,true);
        } else {
            PWM_MAIN.removeCssClass(messageObj,'message-scrollFloat');
            PWM_MAIN.doShow(PWM_GLOBAL['messageStatus'],messageObj.innerHTML,true);
        }
    }
};

PWM_MAIN.pwmFormValidator = function(validationProps, reentrant) {
    var CONSOLE_DEBUG = false;

    var serviceURL = validationProps['serviceURL'];
    var readDataFunction = validationProps['readDataFunction'];
    var processResultsFunction = validationProps['processResultsFunction'];
    var messageWorking = validationProps['messageWorking'] ? validationProps['messageWorking'] : PWM_MAIN.showString('Display_PleaseWait');
    var typeWaitTimeMs = validationProps['typeWaitTimeMs'] ? validationProps['typeWaitTimeMs'] : PWM_GLOBAL['client.ajaxTypingWait'];
    var ajaxTimeout = validationProps['ajaxTimeout'] ? validationProps['ajaxTimeout'] : PWM_GLOBAL['client.ajaxTypingTimeout'];
    var showMessage = 'showMessage' in validationProps ? validationProps['showMessage'] : true;
    var completeFunction = 'completeFunction' in validationProps ? validationProps['completeFunction'] : function(){};


    if (CONSOLE_DEBUG) PWM_MAIN.log("pwmFormValidator: beginning...");

    //init vars;
    if (!PWM_VAR['validationCache']) {
        PWM_VAR['validationCache'] = {};
    }

    // check if data is in cache, if it is just process it.
    var formData = readDataFunction();
    var formDataString = JSON.stringify(formData) ;
    var formKey = formDataString;

    {
        var cachedResult = PWM_VAR['validationCache'][formKey];
        if (cachedResult) {
            processResultsFunction(cachedResult);
            if (CONSOLE_DEBUG) PWM_MAIN.log('pwmFormValidator: processed cached data, exiting');
            completeFunction(cachedResult);
            return;
        }
    }

    if (!reentrant) {
        PWM_VAR['validationLastType'] = new Date().getTime();
    }

    // check to see if user is still typing.  if yes, then come back later.
    if (new Date().getTime() - PWM_VAR['validationLastType'] < typeWaitTimeMs) {
        if (showMessage) {
            PWM_MAIN.showInfo(PWM_MAIN.showString('Display_TypingWait'));
        }
        setTimeout(function(){PWM_MAIN.pwmFormValidator(validationProps, true)}, typeWaitTimeMs + 1);
        if (CONSOLE_DEBUG) PWM_MAIN.log('pwmFormValidator: sleeping while waiting for typing to finish, will retry...');
        return;
    }
    if (CONSOLE_DEBUG) PWM_MAIN.log('pwmFormValidator: user no longer typing, continuing..');

    //check to see if a validation is already in progress, if it is then ignore keypress.
    if (PWM_VAR['validationInProgress'] === true) {
        setTimeout(function(){PWM_MAIN.pwmFormValidator(validationProps, true)}, typeWaitTimeMs + 1);
        if (CONSOLE_DEBUG) PWM_MAIN.log('pwmFormValidator: waiting for a previous validation to complete, exiting...');
        return;
    }
    PWM_VAR['validationInProgress'] = true;

    // show in-progress message if load takes too long.
    if (showMessage) {
        setTimeout(function () {
            if (PWM_VAR['validationInProgress'] === true) {
                PWM_MAIN.showInfo(messageWorking);
            }
        }, 5);
    }

    if (CONSOLE_DEBUG) PWM_MAIN.log('FormValidator: sending form data to server... ' + formDataString);
    var loadFunction = function(data) {
        PWM_VAR['validationInProgress'] = false;
        delete PWM_VAR['validationLastType'];
        PWM_VAR['validationCache'][formKey] = data;
        if (CONSOLE_DEBUG) PWM_MAIN.log('pwmFormValidator: successful read, data added to cache');
        PWM_MAIN.pwmFormValidator(validationProps, true);
    };
    var options = {};
    options['content'] = formData;
    options['ajaxTimeout'] = ajaxTimeout;
    options['errorFunction'] = function(error) {
        PWM_VAR['validationInProgress'] = false;
        if (showMessage) {
            PWM_MAIN.showInfo(PWM_MAIN.showString('Display_CommunicationError'));
        }
        if (CONSOLE_DEBUG) PWM_MAIN.log('pwmFormValidator: error connecting to service: ' + error);
        processResultsFunction(null);
        completeFunction(null);
    };
    PWM_MAIN.ajaxRequest(serviceURL,loadFunction,options);
};

PWM_MAIN.preloadImages = function(imgArray){
    var newimages=[];
    var arr=(typeof imgArray!="object")? [imgArray] : imgArray; //force arr parameter to always be an array
    for (var i=0; i<arr.length; i++){
        newimages[i]=new Image();
        newimages[i].src=arr[i];
    }
};

PWM_MAIN.JSLibrary = {};
PWM_MAIN.JSLibrary.isEmpty = function(o) {
    return PWM_MAIN.JSLibrary.itemCount(o) < 1;
};

PWM_MAIN.JSLibrary.itemCount = function(o) {
    var i = 0;
    for (var key in o) if (o.hasOwnProperty(key)) i++;
    return i;
};

PWM_MAIN.JSLibrary.arrayContains = function(array,element) {
    if (!array) {
        return false;
    }

    return array.indexOf(element) > -1;
};

PWM_MAIN.JSLibrary.getAttribute = function(element,attribute) {
    return PWM_MAIN.getObject(element).getAttribute(attribute);
};

PWM_MAIN.JSLibrary.setAttribute = function(element,attribute,value) {
    PWM_MAIN.getObject(element).setAttribute(attribute,value);
}

PWM_MAIN.JSLibrary.removeFromArray = function(array,element) {
    for(var i = array.length - 1; i >= 0; i--) {
        if(array[i] === element) {
            array.splice(i, 1);
        }
    }
};

PWM_MAIN.JSLibrary.getParameterByName = function(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

PWM_MAIN.JSLibrary.readValueOfSelectElement = function(nodeID) {
    var element = PWM_MAIN.getObject(nodeID);
    if (element && element.options && element.selectedIndex >= 0) {
        return element.options[element.selectedIndex].value;
    }
    return null;
};

PWM_MAIN.JSLibrary.setValueOfSelectElement = function(nodeID, value) {
    var element = PWM_MAIN.getObject(nodeID);
    for(var i=0; i < element.options.length; i++) {
        if (element.options[i].value === value) {
            element.selectedIndex = i;
            break;
        }
    }
};

PWM_MAIN.JSLibrary.readValueOfRadioFormInput = function(name){
    var value = '';
    var query = "input[name='" + name + "'"
    PWM_MAIN.doQuery(query, function(element){
        if( element.checked ) {
            value = element.value;
        }
    });
    console.log('radioRead name=' + name + ' value=' + value);
    return value;
};

PWM_MAIN.JSLibrary.formToValueMap = function(formElement) {
    formElement = PWM_MAIN.getObject(formElement);
    var returnData = {};
    if ( formElement.elements ) {
        var formElements = formElement.elements;
        for (var i = 0; i < formElements.length; i++) {
            var field = formElements[i];
            if (field.disabled !== true) {
                var name = field.name;
                var value = field.value;
                if (field.tagName && field.tagName.toLowerCase() === 'input' && field.type === 'radio' ) {
                    value = PWM_MAIN.JSLibrary.readValueOfRadioFormInput(name);
                } else if (field.tagName && field.tagName.toLowerCase() === 'select') {
                    value = PWM_MAIN.JSLibrary.readValueOfSelectElement(field);
                } else if (field.type === "checkbox") {
                    value = field.checked.toString();
                }
                if ( name && value ) {
                    returnData[name] = value;
                }
            }
        }
    }

    return returnData;
};

PWM_MAIN.JSLibrary.forEachInArray = function(array,forEachFunction) {
    for (var i=0, l=array.length; i<l; i++) {
        forEachFunction(array[i]);
    }
}

PWM_MAIN.JSLibrary.forEachInObject = function(object,forEachFunction) {
    for (var key in object) {
        if (object.hasOwnProperty(key)) {
            forEachFunction(key,object[key]);
        }
    }
}

PWM_MAIN.JSLibrary.removeElementFromDom = function(elementID) {
    var element = PWM_MAIN.getObject(elementID);
    if (element) {
        element.parentNode.removeChild(element);
    }
};

PWM_MAIN.JSLibrary.onPageLoad = function(callback) {
    if (document.readyState === "complete") {
        callback();
    } else {
        window.addEventListener("load",function(event) {
            callback();
        }, false);
    }
};

PWM_MAIN.toggleFullscreen = function(iconObj,divName) {
    var obj = PWM_MAIN.getObject(divName);

    var storedStyleName = 'fullscreen-style-' + divName;
    if (PWM_GLOBAL[storedStyleName]) {
        iconObj.className = "icon-fullscreen";
        obj.style = PWM_GLOBAL[storedStyleName];
        delete PWM_GLOBAL[storedStyleName];
    } else {
        PWM_GLOBAL[storedStyleName] = obj.style;
        iconObj.className = "icon-resize-full";
        obj.style.position = 'fixed';
        obj.style.top = '0';
        obj.style.left = '0';
        obj.style.bottom = '0';
        obj.style.right = '0';
        obj.style.zIndex = '100';
        obj.style.background = 'white';
    }
    if (PWM_GLOBAL['displayGrid']) {
        PWM_GLOBAL['displayGrid'].resize();
    }
};

PWM_MAIN.updateLoginContexts = function() {
    var ldapProfileElement = PWM_MAIN.getObject('ldapProfile');
    var contextElement = PWM_MAIN.getObject('context');
    if (contextElement && ldapProfileElement) {
        var selectedProfile = ldapProfileElement.options[ldapProfileElement.selectedIndex].value;
        var contextList = PWM_GLOBAL['ldapProfiles'][selectedProfile];
        if (PWM_MAIN.JSLibrary.isEmpty(contextList)) {
            PWM_MAIN.addCssClass( 'contentSelectorWrapper', 'display-none' );
        } else {
            contextElement.innerHTML = '';
            PWM_MAIN.removeCssClass( 'contentSelectorWrapper', 'display-none' );
            for (var iter in contextList) {
                (function (key) {
                    var display = contextList[key];
                    var optionElement = document.createElement('option');
                    optionElement.setAttribute('value', key);
                    optionElement.appendChild(document.createTextNode(display));
                    contextElement.appendChild(optionElement);
                }(iter));
            }
        }
    }
};

//---------- show/hide password handler

var ShowHidePasswordHandler = {};

ShowHidePasswordHandler.idSuffix = '-eye-icon';
ShowHidePasswordHandler.state = {};
ShowHidePasswordHandler.toggleRevertTimeout = 30 * 1000; //default value, overridden by settings.
ShowHidePasswordHandler.debugOutput = false;

ShowHidePasswordHandler.initAllForms = function() {
    if (!PWM_GLOBAL['setting-showHidePasswordFields']) {
        return;
    }

    PWM_MAIN.doQuery('.passwordfield',function(field){
        if (field.id) {
            if (ShowHidePasswordHandler.debugOutput) PWM_MAIN.log('adding show/hide option on fieldID=' + field.id);
            ShowHidePasswordHandler.init(field.id);
        }
    });
};

ShowHidePasswordHandler.init = function(nodeName) {
    if (!PWM_GLOBAL['setting-showHidePasswordFields']) {
        return;
    }

    var node = PWM_MAIN.getObject(nodeName);
    if (!node) {
        return;
    }

    ShowHidePasswordHandler.toggleRevertTimeout = PWM_GLOBAL['client.pwShowRevertTimeout'] || ShowHidePasswordHandler.toggleRevertTimeout;
    var eyeId = nodeName + ShowHidePasswordHandler.idSuffix;
    if (PWM_MAIN.getObject(eyeId)) {
        return;
    }

    var defaultType = PWM_MAIN.JSLibrary.getAttribute(node, "type");
    PWM_MAIN.JSLibrary.setAttribute(node, "data-originalType", defaultType);
    PWM_MAIN.JSLibrary.setAttribute(node, "data-managedByShowHidePasswordHandler","true");

    var divElement = document.createElement('div');
    divElement.id = eyeId;
    divElement.onclick = function(){ShowHidePasswordHandler.toggle(nodeName)};
    divElement.style.cursor = 'pointer';
    divElement.style.visibility = 'hidden';
    divElement.setAttribute('class','pwm-icon icon-showhidepassword');
    node.parentNode.insertBefore(divElement, node.nextSibling);

    ShowHidePasswordHandler.state[nodeName] = (defaultType === "password");
    ShowHidePasswordHandler.setupTooltip(nodeName, false);
    ShowHidePasswordHandler.addInputEvents(nodeName);
};

ShowHidePasswordHandler.renderIcon = function(nodeName) {
    if (ShowHidePasswordHandler.debugOutput) PWM_MAIN.log("calling renderIcon on node " + nodeName);
    var node = PWM_MAIN.getObject(nodeName);
    var eyeId = nodeName + ShowHidePasswordHandler.idSuffix;
    var eyeNode = PWM_MAIN.getObject(eyeId);
    if (node && node.value && node.value.length > 0) {
        eyeNode.style.visibility = 'visible';
    } else {
        eyeNode.style.visibility = 'hidden';
    }
    eyeNode.className = eyeNode.className; //ie8 force-rendering hack
};

ShowHidePasswordHandler.toggle = function(nodeName) {
    if (ShowHidePasswordHandler.state[nodeName]) {
        ShowHidePasswordHandler.show(nodeName);
    } else {
        ShowHidePasswordHandler.hide(nodeName);
    }
};

ShowHidePasswordHandler.hide = function(nodeName) {
    ShowHidePasswordHandler.state[nodeName] = true;
    PWM_MAIN.getObject(nodeName).setAttribute('type','password');
    ShowHidePasswordHandler.setupTooltip(nodeName);
    ShowHidePasswordHandler.renderIcon(nodeName);
    var node = PWM_MAIN.getObject(nodeName);
    node.focus();
};

ShowHidePasswordHandler.show = function(nodeName) {
    ShowHidePasswordHandler.state[nodeName] = false;
    PWM_MAIN.getObject(nodeName).setAttribute('type','text');
    ShowHidePasswordHandler.setupTooltip(nodeName);
    ShowHidePasswordHandler.renderIcon(nodeName);

    var node = PWM_MAIN.getObject(nodeName);
    node.focus();
    var defaultType = node.getAttribute('data-originalType');
    if (defaultType === 'password') {
        setTimeout(function () {
            if (!ShowHidePasswordHandler.state[nodeName]) {
                ShowHidePasswordHandler.toggle(nodeName);
            }
        }, ShowHidePasswordHandler.toggleRevertTimeout);
    }
};

ShowHidePasswordHandler.addInputEvents = function(nodeName) {
    PWM_MAIN.addEventHandler(nodeName, "keyup, input", function(){
        if (ShowHidePasswordHandler.debugOutput) PWM_MAIN.log("keypress event on node " + nodeName);
        ShowHidePasswordHandler.renderIcon(nodeName);
        ShowHidePasswordHandler.setupTooltip(nodeName);
    });

};

ShowHidePasswordHandler.setupTooltip = function(nodeName) {
    if (ShowHidePasswordHandler.debugOutput) PWM_MAIN.log('begin setupTooltip');
    var state = ShowHidePasswordHandler.state[nodeName];
    var eyeNodeId = nodeName + ShowHidePasswordHandler.idSuffix;

    if (state) {
        PWM_MAIN.showTooltip({id:eyeNodeId,text:PWM_MAIN.showString('Button_Show')});
        PWM_MAIN.removeCssClass(eyeNodeId,"pwm-icon-eye-slash");
        PWM_MAIN.addCssClass(eyeNodeId,"pwm-icon-eye");
        if (ShowHidePasswordHandler.debugOutput) PWM_MAIN.log('set class to pwm-icon-eye');
    } else {
        PWM_MAIN.showTooltip({id:eyeNodeId,text:PWM_MAIN.showString('Button_Hide')});
        PWM_MAIN.removeCssClass(eyeNodeId,"pwm-icon-eye");
        PWM_MAIN.addCssClass(eyeNodeId,"pwm-icon-eye-slash");
        if (ShowHidePasswordHandler.debugOutput) PWM_MAIN.log('set class to pwm-icon-slash');
    }
};

//---------- idle timeout handler

PWM_MAIN.IdleTimeoutHandler = {};

PWM_MAIN.IdleTimeoutHandler.SETTING_LOOP_FREQUENCY = 1000;   // milliseconds
PWM_MAIN.IdleTimeoutHandler.SETTING_WARN_SECONDS = 30;       // seconds
PWM_MAIN.IdleTimeoutHandler.SETTING_POLL_SERVER_SECONDS = 10; //
PWM_MAIN.IdleTimeoutHandler.timeoutSeconds = 0; // idle timeout time permitted
PWM_MAIN.IdleTimeoutHandler.lastActivityTime = new Date(); // time at which we are "idled out"
PWM_MAIN.IdleTimeoutHandler.lastPingTime = new Date(); // date at which the last ping occured
PWM_MAIN.IdleTimeoutHandler.realWindowTitle = "";
PWM_MAIN.IdleTimeoutHandler.warningDisplayed = false;

PWM_MAIN.IdleTimeoutHandler.initCountDownTimer = function(secondsRemaining) {
    PWM_MAIN.IdleTimeoutHandler.timeoutSeconds = secondsRemaining;
    PWM_MAIN.IdleTimeoutHandler.lastPingTime = new Date();
    PWM_MAIN.IdleTimeoutHandler.realWindowTitle = document.title;
    PWM_MAIN.IdleTimeoutHandler.resetIdleCounter();
    setInterval(function(){PWM_MAIN.IdleTimeoutHandler.pollActivity()}, PWM_MAIN.IdleTimeoutHandler.SETTING_LOOP_FREQUENCY); //poll scrolling
    PWM_MAIN.addEventHandler(document, "click", function(){PWM_MAIN.IdleTimeoutHandler.resetIdleCounter()});
    PWM_MAIN.addEventHandler(document, "keypress", function(){PWM_MAIN.IdleTimeoutHandler.resetIdleCounter()});
    PWM_MAIN.addEventHandler(document, "scroll", function(){PWM_MAIN.IdleTimeoutHandler.resetIdleCounter()});
};

PWM_MAIN.IdleTimeoutHandler.cancelCountDownTimer = function() {
    if ( !PWM_GLOBAL['idle_suspendTimeout'] ) { PWM_MAIN.log('disabling idle timeout handler'); }
    PWM_GLOBAL['idle_suspendTimeout'] = true;
};

PWM_MAIN.IdleTimeoutHandler.resumeCountDownTimer = function() {
    if ( PWM_GLOBAL['idle_suspendTimeout'] ) { PWM_MAIN.log('enabling idle timeout handler'); }
    PWM_GLOBAL['idle_suspendTimeout'] = false;
};

PWM_MAIN.IdleTimeoutHandler.countDownTimerEnabled = function() {
    return PWM_GLOBAL['idle_suspendTimeout'] === true;
};

PWM_MAIN.IdleTimeoutHandler.resetIdleCounter = function() {
    PWM_MAIN.IdleTimeoutHandler.lastActivityTime = new Date();
    PWM_MAIN.IdleTimeoutHandler.closeIdleWarning();
    PWM_MAIN.IdleTimeoutHandler.pollActivity();
};

PWM_MAIN.IdleTimeoutHandler.pollActivity = function() {
    var secondsRemaining = PWM_MAIN.IdleTimeoutHandler.calcSecondsRemaining();
    var idleDisplayString = PWM_MAIN.IdleTimeoutHandler.makeIdleDisplayString(secondsRemaining);
    var idleStatusFooter = PWM_MAIN.getObject("idle_status");
    if (idleStatusFooter) {
        idleStatusFooter.firstChild.nodeValue = idleDisplayString;
    }

    var warningDialogText = PWM_MAIN.getObject("IdleDialogWindowIdleText");
    if (warningDialogText) {
        warningDialogText.firstChild.nodeValue = idleDisplayString;
    }

    if (secondsRemaining < 0) {
        if (!PWM_GLOBAL['idle_suspendTimeout']) {
            PWM_GLOBAL['idle_suspendTimeout'] = true;
            var url = PWM_GLOBAL['url-logout'] + '?idle=true&url=' + encodeURIComponent(window.location.pathname);
            PWM_MAIN.gotoUrl(url);
        } else {
            try { PWM_MAIN.getObject('idle_wrapper').style.visibility = 'none'; } catch(e) { /* noop */ }
        }
        return;
    }

    var pingAgoMs = (new Date()).getTime() - PWM_MAIN.IdleTimeoutHandler.lastPingTime.getTime();
    if (pingAgoMs > (PWM_MAIN.IdleTimeoutHandler.timeoutSeconds - PWM_MAIN.IdleTimeoutHandler.SETTING_POLL_SERVER_SECONDS) * 1000) {
        PWM_MAIN.IdleTimeoutHandler.pingServer();
    }

    if (secondsRemaining < PWM_MAIN.IdleTimeoutHandler.SETTING_WARN_SECONDS) {
        if (!PWM_GLOBAL['idle_suspendTimeout']) {
            PWM_MAIN.IdleTimeoutHandler.showIdleWarning();
            if (secondsRemaining % 2 === 0) {
                document.title = PWM_MAIN.IdleTimeoutHandler.realWindowTitle;
            } else {
                document.title = idleDisplayString;
            }
        }
    }
};

PWM_MAIN.IdleTimeoutHandler.pingServer = function() {
    PWM_MAIN.IdleTimeoutHandler.lastPingTime = new Date();
    console.log("idle timeout ping at " + PWM_MAIN.IdleTimeoutHandler.lastPingTime.toISOString());
    var pingURL = PWM_GLOBAL['url-command'] + "?processAction=idleUpdate&j=1";
    PWM_MAIN.ajaxRequest(pingURL, function(){},{method:'POST',preventCache:true});
};

PWM_MAIN.IdleTimeoutHandler.calcSecondsRemaining = function() {
    var timeoutTime = PWM_MAIN.IdleTimeoutHandler.lastActivityTime.getTime() + (PWM_MAIN.IdleTimeoutHandler.timeoutSeconds * 1000)
    var amount = timeoutTime - (new Date()).getTime();
    amount = Math.floor(amount / 1000);
    return amount;
};

PWM_MAIN.IdleTimeoutHandler.makeIdleDisplayString = function(amount) {
    var output = PWM_MAIN.convertSecondsToDisplayTimeDuration(amount);
    output = PWM_MAIN.showString('Display_IdleTimeout') + " " + output;
    return output;
};

PWM_MAIN.IdleTimeoutHandler.showIdleWarning = function() {
    if (!PWM_MAIN.IdleTimeoutHandler.warningDisplayed) {
        PWM_MAIN.IdleTimeoutHandler.warningDisplayed = true;

        var idleOverlayDiv = document.createElement('div');
        idleOverlayDiv.setAttribute('id','idle-overlay');
        document.body.appendChild(idleOverlayDiv);

        var idleMsgDiv = document.createElement('div');
        idleMsgDiv.setAttribute('id','idle-overlay-message');
        idleMsgDiv.innerHTML = '<p>' + PWM_MAIN.showString('Display_IdleWarningMessage') + '</p><p><span id="IdleDialogWindowIdleText">&nbsp;</span></p>';
        document.body.appendChild(idleMsgDiv);

        PWM_MAIN.addEventHandler('idle-overlay','click',function(){
            idleOverlayDiv.parentNode.removeChild(idleOverlayDiv);
            idleMsgDiv.parentNode.removeChild(idleMsgDiv);
        })
    }
};

PWM_MAIN.IdleTimeoutHandler.closeIdleWarning = function() {
    document.title = PWM_MAIN.IdleTimeoutHandler.realWindowTitle;
    PWM_MAIN.IdleTimeoutHandler.warningDisplayed = false;
};

PWM_MAIN.TimestampHandler = PWM_MAIN.TimestampHandler || {};
PWM_MAIN.TimestampHandler.PreferencesKey = 'timestampLocalized';
PWM_MAIN.TimestampHandler.ElementList = [];

PWM_MAIN.TimestampHandler.initAllElements = function() {
    PWM_MAIN.doQuery(".timestamp",function(node){
        PWM_MAIN.TimestampHandler.initElement(node);
    });
};

PWM_MAIN.TimestampHandler.testIfStringIsTimestamp = function(input, trueFunction) {
    if (input && input.length > 0) {
        input = input.trim();
        var timestamp = Date.parse(input);
        if (isNaN(timestamp) === false) {
            trueFunction(new Date(timestamp));
        }
    }
};

PWM_MAIN.TimestampHandler.initElement = function(element) {
    if (!element) {
        return
    }

    if (element.getAttribute('data-timestamp-init') === 'true') {
        return;
    }

    var innerText = element.innerHTML;
    innerText = innerText.trim(innerText);
    PWM_MAIN.TimestampHandler.testIfStringIsTimestamp(innerText, function () {
        element.setAttribute('data-timestamp-original', innerText);
        PWM_MAIN.addEventHandler(element, 'click', function(){
            var LocalizedState = !PWM_MAIN.Preferences.readSessionStorage(PWM_MAIN.TimestampHandler.PreferencesKey,true);
            PWM_MAIN.Preferences.writeSessionStorage(PWM_MAIN.TimestampHandler.PreferencesKey, LocalizedState);
            PWM_MAIN.TimestampHandler.updateAllElements();
        });
        if (!PWM_MAIN.hasCssClass(element,"timestamp")) {
            PWM_MAIN.addCssClass(element,"timestamp");
        }

        element.setAttribute('data-timestamp-init', 'true');
        PWM_MAIN.TimestampHandler.ElementList.push(element);
        PWM_MAIN.TimestampHandler.updateElement(element);
    });
};

PWM_MAIN.TimestampHandler.updateAllElements = function() {
    PWM_MAIN.JSLibrary.forEachInArray(PWM_MAIN.TimestampHandler.ElementList,function(element){
        if (document.body.contains(element)) {
            PWM_MAIN.TimestampHandler.updateElement(element);
        } else {
            PWM_MAIN.JSLibrary.removeFromArray(PWM_MAIN.TimestampHandler.ElementList,element);
        }
    });
};

PWM_MAIN.TimestampHandler.updateElement = function(element) {
    var localized = PWM_MAIN.Preferences.readSessionStorage(PWM_MAIN.TimestampHandler.PreferencesKey,true);
    if (localized) {
        var isoDateStr = element.getAttribute('data-timestamp-original');
        var date = new Date(Date.parse(isoDateStr));
        var localizedStr = PWM_MAIN.TimestampHandler.formatDate(date);
        element.innerHTML = localizedStr;
    } else {
        element.innerHTML = element.getAttribute('data-timestamp-original');
    }
};

PWM_MAIN.TimestampHandler.formatDate = function(dateObj) {
    var options = {timeZoneName:'short', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'};
    var locale = PWM_GLOBAL['client.locale'];
    return dateObj.toLocaleString(locale, options);
};

PWM_MAIN.addPwmFormIDtoURL = function(url) {
    return PWM_MAIN.addParamToUrl(url,'pwmFormID',PWM_GLOBAL['pwmFormID']);
};

PWM_MAIN.addParamToUrl = function(url,paramName,paramValue) {
    if (!url || url.length < 1) {
        return url;
    }

    if (
        url.indexOf('?' + paramName + '=') > -1
        || url.indexOf('&' + paramName + '=') > -1)
    {
        console.warn('ignoring request to append duplicate param "' + paramName + '" to url ' + url);
        return url;
    }

    var encodedName = encodeURIComponent(paramName);
    var encodedValue = encodeURIComponent(paramValue);

    url += url.indexOf('?') > 0 ? '&' : '?';
    url += encodedName + "=" + encodedValue;
    return url;
};

PWM_MAIN.ajaxRequest = function(url,loadFunction,options) {
    options = options === undefined ? {} : options;
    var content = 'content' in options ? options['content'] : null;
    var method = 'method' in options ? options['method'] : 'POST';
    var responseMimeType = 'responseMimeType' in options ? options['responseMimeType'] : 'application/json';
    var handleAs = 'handleAs' in options ? options['handleAs'] : 'json';
    var errorFunction = 'errorFunction' in options ? options['errorFunction'] : function(error){
        var status = error['response']['status'];
        if (status === 0 || status < 200 || status >= 300) {
            var msg = PWM_MAIN.showString("Display_ClientDisconnect") + "  (" + status + ")";
            PWM_MAIN.log(msg);
            PWM_MAIN.showErrorDialog(msg);
        } else {
            PWM_MAIN.showErrorDialog(error);
        }
    };
    var hasContent = options['content'] !== null && options['content'] !== undefined;
    var preventCache = 'preventCache' in options ? options['preventCache'] : true;
    var addPwmFormID = 'addPwmFormID' in options ? options['addPwmFormID'] : true;
    var ajaxTimeout = options['ajaxTimeout'] ? options['ajaxTimeout'] : PWM_MAIN.ajaxTimeout;
    var requestHeaders = {};
    requestHeaders['Accept'] = responseMimeType;
    if (hasContent) {
        requestHeaders['Content-Type'] = responseMimeType;
    }

    if (addPwmFormID) {
        url = PWM_MAIN.addPwmFormIDtoURL(url);
    }
    if (preventCache) {
        url = PWM_MAIN.addParamToUrl(url, 'preventCache', (new Date).valueOf());
    }

    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
        if ( loadFunction === undefined ) {
            alert('missing load function, return results:' + xhr.response)
        } else {
            var response = xhr.response;
            // run parser for IE
            if ( typeof response === "string" && handleAs === "json") {
                response = JSON.parse( response );
            }
            if (xhr.status===200) {
                loadFunction(response);
            } else {
                errorFunction(response)
            }
        }
    };
    xhr.onerror = errorFunction;
    xhr.ontimeout = errorFunction;
    xhr.open(method, url);
    xhr.responseType = handleAs;
    xhr.timeout = ajaxTimeout;

    for (var headerKey in requestHeaders) {
        xhr.setRequestHeader( headerKey, requestHeaders[headerKey]);
    }

    if ( hasContent ) {
        xhr.send( JSON.stringify( content ) );
    } else {
        xhr.send();
    }
};

PWM_MAIN.convertSecondsToDisplayTimeDuration = function(amount, fullLength) {
    if (amount < 1) {
        return "";
    }

    var output = "";

    var days = Math.floor(amount / 86400);

    amount = amount % 86400;
    var hours = Math.floor(amount / 3600);

    amount = amount % 3600;
    var mins = Math.floor(amount / 60);

    amount = amount % 60;
    var secs = Math.floor(amount);

    // write number of days
    var positions = 0;
    if (days !== 0) {
        output += days + " ";
        if (days !== 1) {
            output += PWM_MAIN.showString('Display_Days');
        } else {
            output += PWM_MAIN.showString('Display_Day');
        }
        positions++;
    }

    // write number of hours
    if (days !== 0 || hours !== 0) {
        if (output.length > 0) {
            output += ", ";
        }

        output += hours + " ";
        if (hours !== 1) {
            output += PWM_MAIN.showString('Display_Hours');
        } else {
            output += PWM_MAIN.showString('Display_Hour');
        }
        positions ++;
    }

    // write number of minutes
    if (positions < 2 || fullLength) {
        if (days !== 0 || hours !== 0 || mins !== 0 || fullLength) {
            if (output.length > 0) {
                output += ", ";
            }
            output += mins + " ";
            if (mins !== 1) {
                output += PWM_MAIN.showString('Display_Minutes');
            } else {
                output += PWM_MAIN.showString('Display_Minute');
            }
            positions++;
        }
    }

    // write number of seconds
    if (positions < 2 || fullLength) {
        if (mins < 4 || fullLength) {
            if (output.length > 0) {
                output += ", ";
            }

            output += secs + " ";

            if (secs !== 1) {
                output += PWM_MAIN.showString('Display_Seconds');
            } else {
                output += PWM_MAIN.showString('Display_Second');
            }
        }
    }

    return output;
};

PWM_MAIN.setStyle = function(elementID, property, value) {

    require(["dojo"],function(dojo) {
        if (dojo.isIE <= 8) { // IE8 and below cant handle the css associated with the locale select menu
            try {
                var element = PWM_MAIN.getObject(elementID);
                if (element) {
                    element.style[property] = value;
                }
            } catch (e) {
                console.error('error while setting ie8 style, elementID=' + elementID + ", property=" + property + ", value=" + value + ", error: " + e);
            }
        } else {
            try {
                var element = PWM_MAIN.getObject(elementID);
                if (element) {
                    element.style.setProperty(property, value, null);
                }
            } catch (e) {
                console.error('error while setting style, elementID=' + elementID + ", property=" + property + ", value=" + value + ", error: " + e);
            }
        }
    });
};

PWM_MAIN.addCssClass = function(elementID, className) {
    var element = PWM_MAIN.getObject(elementID);
    if (element) {
        element.classList.add(className);
    }
};

PWM_MAIN.removeCssClass = function(elementID, className) {
    var element = PWM_MAIN.getObject(elementID);
    if (element) {
        element.classList.remove(className);
    }
};

PWM_MAIN.hasCssClass = function(elementID, className) {
    var element = PWM_MAIN.getObject(elementID);
    return element && element.classList.contains(className);
};

PWM_MAIN.newWindowOpen=function(windowUrl,windowName) {
    var windowParams = 'status=0,toolbar=0,location=0,menubar=0,scrollbars=1,resizable=1';
    var viewLog = window.open(windowUrl,windowName,windowParams).focus();
};

PWM_MAIN.cancelEvent = function(event) {
    if (event) {
        if (event.preventDefault) {
            event.preventDefault();
        } else if (event.returnValue) {
            event.returnValue = false;
        }
    }
};

PWM_MAIN.submitPostAction = function(actionUrl,actionValue,additionalValues) {
    var fields = {};
    fields['processAction'] = actionValue;
    fields['pwmFormID'] = PWM_GLOBAL['pwmFormID'];
    if (additionalValues) {
        var addValueFunction = function(key) {
            fields[key] = additionalValues[key];
        };
        for (var key in additionalValues) {
            addValueFunction(key);
        }
    }
    var makeFieldHtml = function() {
        var text = '';
        var addField = function(key) {
            return '<input type="hidden" name="' + key + '" value="' + fields[key] + '"></input>';
        };
        for (var key in fields) {
            text += addField(key);
        }
        return text;
    };
    var formElement = document.createElement('form');
    formElement.setAttribute('id','form-jsSendAction');
    formElement.setAttribute('action',actionUrl);
    formElement.setAttribute('method','post');
    formElement.setAttribute('style','display:none');
    formElement.innerHTML = makeFieldHtml();
    document.body.appendChild(formElement);
    PWM_MAIN.handleFormSubmit(formElement);
};

PWM_MAIN.doQuery = function(queryString, resultFunction) {
    var results = document.querySelectorAll(queryString);
    PWM_MAIN.JSLibrary.forEachInArray(results,resultFunction);
};

PWM_MAIN.doIfQueryHasResults = function(queryString, trueFunction) {
    if (document.querySelector(queryString)) trueFunction();
};

PWM_MAIN.stopEvent = function(e) {
    if (!e) var e = window.event;
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
};

PWM_MAIN.clearFocus = function() {
    document.activeElement.blur();
};

PWM_MAIN.Preferences = {};
PWM_MAIN.Preferences.StorageKeyName = 'preferences';
PWM_MAIN.Preferences.Key_Timestamp = 'timestamp';
PWM_MAIN.Preferences.Key_ExpireSeconds = 'expireSeconds';
PWM_MAIN.Preferences.Key_Value = 'value';
PWM_MAIN.Preferences.readLocalStorage = function(key,valueIfMissing) {
    if(typeof(Storage) !== "undefined") {
        try {
            var baseObjStr = localStorage.getItem(PWM_MAIN.Preferences.StorageKeyName);
            if (baseObjStr) {
                var baseJson = JSON.parse(baseObjStr);
                var wrappedValue = baseJson[key];
                if (wrappedValue !== null) {
                    var timestamp = new Date(Date.parse(wrappedValue[PWM_MAIN.Preferences.Key_Timestamp]));
                    var expireSeconds = parseInt(wrappedValue[PWM_MAIN.Preferences.Key_ExpireSeconds]);
                    var valueAgeSeconds = (new Date().getTime()) - timestamp.getTime();
                    if (valueAgeSeconds > (expireSeconds * 1000)) {
                        delete baseJson[key];
                        localStorage.setItem(PWM_MAIN.Preferences.StorageKeyName,JSON.stringify(baseJson));
                        return valueIfMissing;
                    }

                    return wrappedValue[PWM_MAIN.Preferences.Key_Value];
                }
            }
        } catch (e) {
            PWM_MAIN.log("error reading locale storage preferences: " + e);
        }
    } else {
        PWM_MAIN.log("browser doesn't support local storage");
    }
    return valueIfMissing;
};

PWM_MAIN.Preferences.writeLocalStorage = function(key, value, lifetimeSeconds) {
    if(typeof(Storage) !== "undefined") {
        try {
            var baseObjStr = localStorage.getItem(PWM_MAIN.Preferences.StorageKeyName);
            var baseJson = baseObjStr !== null ? JSON.parse(baseObjStr) : {};
            var wrapperValue = {};
            wrapperValue[PWM_MAIN.Preferences.Key_Timestamp] = new Date().toISOString();
            wrapperValue[PWM_MAIN.Preferences.Key_ExpireSeconds] = lifetimeSeconds;
            wrapperValue[PWM_MAIN.Preferences.Key_Value] = value;
            baseJson[key] = wrapperValue;
            localStorage.setItem(PWM_MAIN.Preferences.StorageKeyName,JSON.stringify(baseJson));
        } catch (e) {
            PWM_MAIN.log("error writing locale storage preferences: " + e);
        }
    } else {
        PWM_MAIN.log("browser doesn't support local storage");
    }
};

PWM_MAIN.Preferences.readSessionStorage = function(key,valueIfMissing) {
    if(typeof(Storage) !== "undefined") {
        try {
            var baseObjStr = sessionStorage.getItem(PWM_MAIN.Preferences.StorageKeyName);
            if (baseObjStr !== null) {
                var baseJson = JSON.parse(baseObjStr);
                return key in baseJson ? baseJson[key] : valueIfMissing;
            }
        } catch (e) {
            PWM_MAIN.log("error reading session storage preferences: " + e);
        }
    } else {
        PWM_MAIN.log("browser doesn't support session storage");
    }
    return valueIfMissing;
};

PWM_MAIN.Preferences.writeSessionStorage = function(key, value) {
    if(typeof(Storage) !== "undefined") {
        try {
            var baseObjStr = sessionStorage.getItem(PWM_MAIN.Preferences.StorageKeyName);
            var baseJson = baseObjStr !== null ? JSON.parse(baseObjStr) : {};
            baseJson[key] = value;
            sessionStorage.setItem(PWM_MAIN.Preferences.StorageKeyName,JSON.stringify(baseJson));
        } catch (e) {
            PWM_MAIN.log("error writing session storage preferences: " + e);
        }
    } else {
        PWM_MAIN.log("browser doesn't support session storage");
    }
};

PWM_MAIN.copyObject = function(input) {
    return JSON.parse(JSON.stringify(input));
};

PWM_MAIN.numberFormat = function (number) {
    try {
        return new Number(number).toLocaleString();
    } catch (t) {
        PWM_MAIN.log('error localizing number value "' + number + '", error: ' + t);
    }

    return number;
};

PWM_MAIN.loadJsFile = function(filename) {
    var script = document.createElement("script");  // create a script DOM node
    script.src = filename;
    script.type = 'text/javascript'
    document.head.appendChild(script);
    PWM_MAIN.log("main: loaded js file: " + filename)
};

PWM_MAIN.pageLoadHandler();

