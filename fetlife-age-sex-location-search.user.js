/**
 * This is a Greasemonkey script and must be run using a Greasemonkey-compatible browser.
 *
 * @author maymay <bitetheappleback@gmail.com>
 */
// ==UserScript==
// @name           FetLife ASL Search (Extened Edition)
// @version        0.4.2.1
// @namespace      http://maybemaimed.com/playground/fetlife-aslsearch/
// @updateURL      https://github.com/meitar/fetlife-aslsearch/raw/master/fetlife-age-sex-location-search.user.js
// @description    Allows you to search for FetLife profiles based on age, sex, location, and role.
// @require        https://code.jquery.com/jquery-2.1.4.min.js
// @include        https://fetlife.com/administrative_areas*
// @include        https://fetlife.com/cities*
// @include        https://fetlife.com/countries*
// @include        https://fetlife.com/events*
// @include        https://fetlife.com/fetishes*
// @include        https://fetlife.com/fetlife*
// @include        https://fetlife.com/groups*
// @include        https://fetlife.com/home*
// @include        https://fetlife.com/improvements*
// @include        https://fetlife.com/places*
// @include        https://fetlife.com/posts*
// @include        https://fetlife.com/search*
// @include        https://fetlife.com/users*
// @include        https://fetlife.com/videos*
// @include        https://www.creepshield.com/search*
// @exclude        https://fetlife.com/adgear/*
// @exclude        https://fetlife.com/chat/*
// @exclude        https://fetlife.com/im_sessions*
// @exclude        https://fetlife.com/polling/*
// @grant          GM_log
// @grant          GM_xmlhttpRequest
// @grant          GM_addStyle
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_deleteValue
// @grant          GM_openInTab
// ==/UserScript==

FL_UI = {}; // FetLife User Interface module
FL_UI.Text = {
    'donation_appeal': '<p>FetLife ASL Search is provided as free software, but sadly grocery stores do not offer free food. If you like this script, please consider <a href="http://Cyberbusking.org/">making a donation</a> to support its continued development. &hearts; Thank you. :)</p>'
};
FL_UI.Dialog = {};
FL_UI.Dialog.createLink = function (dialog_id, html_content, parent_node) {
    var trigger_el = document.createElement('a');
    trigger_el.setAttribute('class', 'opens-modal');
    trigger_el.setAttribute('data-opens-modal', dialog_id);
    trigger_el.innerHTML = html_content;
    return parent_node.appendChild(trigger_el);
};
FL_UI.Dialog.inject = function (id, title, html_content) {
    // Inject dialog box HTML. FetLife currently uses Rails 3, so mimic that.
    // See, for instance, Rails Behaviors: http://josh.github.com/rails-behaviors/
    var dialog = document.createElement('div');
    dialog.setAttribute('style', 'display: none; position: absolute; overflow: hidden; z-index: 1000; outline: 0px none;');
    dialog.setAttribute('class', 'ui-dialog ui-widget ui-widget-content ui-corner-all');
    dialog.setAttribute('tabindex', '-1');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-labelledby', 'ui-dialog-title-' + id);
    var html_string = '<div class="ui-dialog-titlebar ui-widget-header ui-corner-all ui-helper-clearfix" unselectable="on" style="-moz-user-select: none;">';
    html_string += '<span class="ui-dialog-title" id="ui-dialog-title-' + id + '" unselectable="on" style="-moz-user-select: none;">' + title + '</span>';
    html_string += '<a href="#" class="ui-dialog-titlebar-close ui-corner-all" role="button" unselectable="on" style="-moz-user-select: none;">';
    html_string += '<span class="ui-icon ui-icon-closethick" unselectable="on" style="-moz-user-select: none;">close</span>';
    html_string += '</a>';
    html_string += '</div>';
    html_string += '<div data-modal-title="' + title + '" data-modal-height="280" data-modal-auto-open="false" class="modal ui-dialog-content ui-widget-content" id="' + id + '">';
    html_string += html_content;
    html_string += '</div>';
    dialog.innerHTML = html_string;
    document.body.appendChild(dialog);
};

FL_ASL = {}; // FetLife ASL Search module
FL_ASL.CONFIG = {
    'debug': false, // switch to true to debug.
    'gasapp_url': 'https://script.google.com/macros/s/AKfycbxjpuCSz9uam23hztGYyiE6IbHX22EGzhq7fN4jQGo1jiRp520/exec?embedded=true',
    'gasapp_url_development': 'https://script.google.com/macros/s/AKfycbxl668Zzz6FW9iLMqtyP_vZYkvqOJK3ZKX308fMcCc/dev?embedded=true',
    'progress_id': 'fetlife_asl_search_progress',
    'min_matches': 1, // show at least this many matches before offering to search again
    'search_sleep_interval': 3 // default wait time in seconds between auto-searches
};

FL_ASL.total_result_count = 0; // How many matches have we found, across all pages, on this load?

// Utility debugging function.
FL_ASL.log = function (msg) {
    if (!FL_ASL.CONFIG.debug) { return; }
    GM_log('FETLIFE ASL SEARCH: ' + msg);
};

// XPath Helper function
// @see http://wiki.greasespot.net/XPath_Helper
function $x() {
  var x='';
  var node=document;
  var type=0;
  var fix=true;
  var i=0;
  var cur;

  function toArray(xp) {
    var final=[], next;
    while (next=xp.iterateNext()) {
      final.push(next);
    }
    return final;
  }

  while (cur=arguments[i++]) {
    switch (typeof cur) {
      case "string": x+=(x=='') ? cur : " | " + cur; continue;
      case "number": type=cur; continue;
      case "object": node=cur; continue;
      case "boolean": fix=cur; continue;
    }
  }

  if (fix) {
    if (type==6) type=4;
    if (type==7) type=5;
  }

  // selection mistake helper
  if (!/^\//.test(x)) x="//"+x;

  // context mistake helper
  if (node!=document && !/^\./.test(x)) x="."+x;

  var result=document.evaluate(x, node, null, type, null);
  if (fix) {
    // automatically return special type
    switch (type) {
      case 1: return result.numberValue;
      case 2: return result.stringValue;
      case 3: return result.booleanValue;
      case 8:
      case 9: return result.singleNodeValue;
    }
  }

  return fix ? toArray(result) : result;
};

// Initializations.
var uw = (unsafeWindow) ? unsafeWindow : window ; // Help with Chrome compatibility?
GM_addStyle('\
#fetlife_asl_search_ui_container,\
#fetlife_asl_search_about,\
#fetlife_asl_search_classic\
{ display: none; }\
#fetlife_asl_search_ui_container > div {\
    clear: both;\
    background-color: #111;\
    position: relative;\
    top: -2px;\
}\
#fetlife_asl_search_ui_container div a, #fetlife_asl_search_results div a {\
    text-decoration: underline;\
}\
#fetlife_asl_search_ui_container div a:hover, #fetlife_asl_search_results div a:hover {\
    background-color: blue;\
    text-decoration: underline;\
}\
#fetlife_asl_search_ui_container a[data-opens-modal] { cursor: help; }\
#fetlife_asl_search_ui_container ul.tabs li {\
    display: inline-block;\
    margin-right: 10px;\
}\
#fetlife_asl_search_ui_container ul.tabs li a { color: #888; }\
#fetlife_asl_search_ui_container ul.tabs li.in_section a {\
    background-color: #1b1b1b;\
    color: #fff;\
    position: relative;\
    top: 2px;\
    padding-top: 5px;\
}\
#fetlife_asl_search_classic fieldset { clear: both; margin: 0; padding: 0; }\
#fetlife_asl_search_classic legend { display: none; }\
#fetlife_asl_search_classic label {\
    display: inline-block;\
    white-space: nowrap;\
}\
#fetlife_asl_search_classic input { width: auto; }\
#fetlife_asl_search_results { clear: both; }\
#fetlife_asl_search_extended_wrapper { position: relative; }\
#fetlife_asl_search_extended_cover {\
    background: #000;\
    width: 100%; height: 53px;\
    position: absolute; top: 23px; left: 0;\
    font-size: xx-large;\
}\
');
FL_ASL.init = function () {
    FL_ASL.CONFIG.search_form = document.querySelector('form[action="/search"]').parentNode;
    if (FL_ASL.getUserProfileHtml()) {
        FL_ASL.main();
    } else {
        FL_ASL.loadUserProfileHtml(FL_ASL.main);
    }
};
window.addEventListener('DOMContentLoaded', FL_ASL.init);

FL_ASL.toggleAslSearch = function () {
    var el = document.getElementById('fetlife_asl_search_ui_container');
    if (el.style.display == 'block') {
        el.style.display = 'none';
    } else {
        el.style.display = 'block';
    }
};

FL_ASL.toggleLocationFilter = function (e) {
    var el = document.getElementById('fl_asl_loc_filter_label');
    switch (e.currentTarget.value) {
        case 'group':
        case 'event':
        case 'fetish':
        case 'search':
        case 'user':
            if (el.style.display == 'none') {
                el.style.display = 'inline';
            }
            break;
        default:
            el.style.display = 'none';
            break;
    }
};

FL_ASL.aslSubmit = function (e) {
    var el = document.getElementById('fetlife_asl_search');
    if (!el.checked) {
        return false;
    }

    // Provide UI feedback.
    var prog = document.getElementById(FL_ASL.CONFIG.progress_id);
    prog.innerHTML = 'Searching&hellip;<br />';

    // collect the form parameters
    var search_params = FL_ASL.getSearchParams();

    // search one of the geographic regions "/kinksters" list
    FL_ASL.getKinkstersInSet(search_params.loc);

    return false;
};

/**
 * Reads and saves the search parameters from the provided form.
 */
FL_ASL.getSearchParams = function () {
    var r = {
        'age'   : {'min': null, 'max': null},
        'sex'   : [],
        'role'  : [],
        'loc'   : {},
        'filter': ''
    };

    // Collect age parameters, setting wide defaults.
    r.age.min = (document.getElementById('min_age').value) ? parseInt(document.getElementById('min_age').value) : 1;
    r.age.max = (document.getElementById('max_age').value) ? parseInt(document.getElementById('max_age').value) : 99;

    // Collect gender/sex parameters.
    var x = FL_ASL.CONFIG.search_form.querySelectorAll('input[name="user[sex]"]');
    for (var i = 0; i < x.length; i++) {
        if (x[i].checked) {
            r.sex.push(x[i].value);
        }
    }

    // Collect role orientation parameters.
    var y = FL_ASL.CONFIG.search_form.querySelectorAll('input[name="user[role]"]');
    for (var iy = 0; iy < y.length; iy++) {
        if (y[iy].checked) {
            r.role.push(y[iy].value);
        }
    }

    // Collect location parameters.
    var search_in = [];
    var z = FL_ASL.CONFIG.search_form.querySelectorAll('input[name="fl_asl_loc"]');
    for (var iz = 0; iz < z.length; iz++) {
        if (z[iz].checked) {
            search_in.push(z[iz].value);
        }
    }
    // Match location parameter with known location ID.
    switch (search_in[0]) {
        // These cases all use numeric object IDs.
        case 'group':
        case 'event':
        case 'user':
        case 'fetish':
            r.loc[search_in[0]] = parseInt(FL_ASL.CONFIG.search_form.querySelector('input[data-flasl' + search_in[0] + 'id]').getAttribute('data-flasl' + search_in[0] + 'id'));
        break;
        // This case uses a string, so no need to parseInt() it.
        case 'search':
            r.loc[search_in[0]] = FL_ASL.CONFIG.search_form.querySelector('input[data-flasl' + search_in[0] + 'id]').getAttribute('data-flasl' + search_in[0] + 'id');
            break;
        default:
            user_loc_ids = FL_ASL.getUserLocationIds();
            for (var xk in user_loc_ids) {
                if (null !== user_loc_ids[xk] && (-1 !== search_in.indexOf(xk)) ) {
                    r.loc[xk] = user_loc_ids[xk];
                }
            }
        break;
    }

    // Collect location filter, if one was entered.
    if (document.getElementById('fl_asl_loc_filter')) {
        r.filter = document.getElementById('fl_asl_loc_filter').value;
    }

    return r;
};

FL_ASL.getUserLocationIds = function () {
    var r = {
        'city_id': null,
        'area_id': null,
        'country': null
    };
    var profile_html = FL_ASL.getUserProfileHtml();
    var m = profile_html.match(/href="\/countries\/([0-9]+)/);
    if (m) {
        r.country = m[1];
    }
    m = profile_html.match(/href="\/administrative_areas\/([0-9]+)/);
    if (m) {
        r.area_id = m[1];
    }
    m = profile_html.match(/href="\/cities\/([0-9]+)/);
    if (m) {
        r.city_id = m[1];
    }

    return r;
};

FL_ASL.getUserProfileHtml = function () {
    return GM_getValue('currentUser.profile_html', false);
};

FL_ASL.loadUserProfileHtml = function (callback, id) {
    var id = id || uw.FetLife.currentUser.id;
    FL_ASL.log('Fetching profile for user ID ' + id.toString());
    GM_xmlhttpRequest({
        'method': 'GET',
        'url': 'https://fetlife.com/users/' + id.toString(),
        'onload': function (response) {
            GM_setValue('currentUser.profile_html', response.responseText);
            callback();
        }
    });
};

FL_ASL.getKinkstersInSet = function (loc_obj) {
    if (loc_obj.group) {
        FL_ASL.getKinkstersInGroup(loc_obj.group);
    } else if (loc_obj.event) {
        FL_ASL.getKinkstersInEvent(loc_obj.event);
    } else if (loc_obj.user) {
        FL_ASL.getKinkstersInFriend(loc_obj.user);
    } else if (loc_obj.fetish) {
        FL_ASL.getKinkstersInFetish(loc_obj.fetish);
    } else if (loc_obj.search) {
        FL_ASL.getKinkstersInSearch(loc_obj.search);
    } else if (loc_obj.city_id) {
        FL_ASL.getKinkstersInCity(loc_obj.city_id);
    } else if (loc_obj.area_id) {
        FL_ASL.getKinkstersInArea(loc_obj.area_id);
    } else if (loc_obj.country) {
        FL_ASL.getKinkstersInCountry(loc_obj.country);
    } else {
        return false;
    }
};

FL_ASL.getKinkstersInCity = function (city_id, page) {
    var url = 'https://fetlife.com/cities/' + city_id.toString() + '/kinksters';
    url = (page) ? url + '?page=' + page.toString() : url ;
    FL_ASL.getKinkstersFromURL(url);
};
FL_ASL.getKinkstersInArea = function (area_id, page) {
    var url = 'https://fetlife.com/administrative_areas/' + area_id.toString() + '/kinksters';
    url = (page) ? url + '?page=' + page.toString() : url ;
    FL_ASL.getKinkstersFromURL(url);
};
FL_ASL.getKinkstersInCountry = function (country, page) {
    var url = 'https://fetlife.com/countries/' + country.toString() + '/kinksters';
    url = (page) ? url + '?page=' + page.toString() : url ;
    FL_ASL.getKinkstersFromURL(url);
};
FL_ASL.getKinkstersInGroup = function (group, page) {
    var url = 'https://fetlife.com/groups/' + group.toString() + '/group_memberships';
    url = (page) ? url + '?page=' + page.toString() : url ;
    FL_ASL.getKinkstersFromURL(url);
};
FL_ASL.getKinkstersInEvent = function (event, page) {
    var url = 'https://fetlife.com/events/' + event.toString() + '/rsvps';
    url = (page) ? url + '?page=' + page.toString() : url ;
    FL_ASL.getKinkstersFromURL(url);
};
FL_ASL.getKinkstersInFriend = function (user_id, page) {
    var url = 'https://fetlife.com/users/' + user_id.toString() + '/friends';
    url = (page) ? url + '?page=' + page.toString() : url ;
    FL_ASL.getKinkstersFromURL(url);
};
FL_ASL.getKinkstersInFetish = function (fetish_id, page) {
    var url = 'https://fetlife.com/fetishes/' + fetish_id.toString() + '/kinksters';
    url = (page) ? url + '?page=' + page.toString() : url ;
    FL_ASL.getKinkstersFromURL(url);
};
FL_ASL.getKinkstersInSearch = function (search_string, page) {
    var url = 'https://fetlife.com/search/kinksters/?q=' + search_string.toString();
    url = (page) ? url + '&page=' + page.toString() : url ;
    FL_ASL.getKinkstersFromURL(url);
};
FL_ASL.getKinkstersFromURL = function (url) {
    var now = new Date(Date.now());
    FL_ASL.log('Current time: ' + now.toUTCString());
    FL_ASL.log('Getting Kinksters list from URL: ' + url);
    // Set minimum matches, if that's been asked for.
    if (document.getElementById('fl_asl_min_matches').value) {
        FL_ASL.CONFIG.min_matches = document.getElementById('fl_asl_min_matches').value;
    }
    if (document.getElementById('fl_asl_search_sleep_interval').value) {
        FL_ASL.CONFIG.search_sleep_interval = document.getElementById('fl_asl_search_sleep_interval').value;
    }
    prog = document.getElementById(FL_ASL.CONFIG.progress_id);
    prog.innerHTML = prog.innerHTML + '.';
    GM_xmlhttpRequest({
        'method': 'GET',
        'url': url,
        'onload': function (response) {
            var parser = new DOMParser();
            var doc = parser.parseFromString(response.responseText, 'text/html');
            var els = doc.querySelectorAll('.user_in_list');
            var end = (!doc.querySelector('.pagination') || doc.querySelector('.pagination .next_page.disabled')) ? true : false;

            result_count = 0;
            for (var i = 0; i < els.length; i++) {
                // filter the results based on the form parameters
                if (FL_ASL.matchesSearchParams(els[i])) {
                    // display the results in a "results" section in this portion of the page
                    FL_ASL.displayResult(els[i]);
                    result_count++;
                    // note total results found
                    FL_ASL.total_result_count += result_count;
                }
            }

            if (end) {
                jQuery('#fetlife_asl_search_progress').html('Search complete. There are no more matching results. To start a new search, <a href="' + window.location.protocol + '//' + window.location.host + window.location.pathname + window.location.search + '">reload this page</a>.');
            } else {
                // Set up next request.
                my_page = (url.match(/\d+$/)) ? parseInt(url.match(/\d+$/)[0]) : 1 ;
                next_page = my_page + 1;
                if (next_page > 2) {
                    next_url = url.replace(/\d+$/, next_page.toString());
                } else {
                    // Already have a query string? If so, append (&) rather than create (?).
                    next_url = (url.match(/\?q=/)) ? url + '&page=' : url + '?page=';
                    next_url += next_page.toString();
                }

                // Automatically search on next page if no or too few results were found.
                if (0 === result_count || FL_ASL.CONFIG.min_matches >= FL_ASL.total_result_count) {
                    setTimeout(FL_ASL.getKinkstersFromURL, FL_ASL.CONFIG.search_sleep_interval * 1000, next_url);
                    return false;
                } else {
                    // Reset total_result_count for this load.
                    FL_ASL.total_result_count = 0;
                    // Reset UI search feedback.
                    p = prog.parentNode
                    p.removeChild(prog);
                    new_prog = document.createElement('p');
                    new_prog.setAttribute('id', FL_ASL.CONFIG.progress_id);
                    p.appendChild(new_prog);
                }
                var div = document.createElement('div');
                div.innerHTML = FL_UI.Text.donation_appeal;
                btn = document.createElement('button');
                btn.setAttribute('id', 'btn_moar');
                btn.setAttribute('onclick', "var xme = document.getElementById('btn_moar'); xme.parentNode.removeChild(xme); return false;");
                btn.innerHTML = 'Show me MOAR&hellip;';
                btn.addEventListener('click', function(){FL_ASL.getKinkstersFromURL(next_url)});
                div.appendChild(btn);
                document.getElementById('fetlife_asl_search_results').appendChild(div);
            }
        }
    });
};

/**
 * Determines whether a "user_in_list" block matches the searched-for parameters.
 *
 * @return True if block matches all search parameters, false otherwise.
 */
FL_ASL.matchesSearchParams = function (el) {
    var search_params = FL_ASL.getSearchParams();

    // Does block match location string filter?
    if (-1 === FL_ASL.getLocationString(el).toLowerCase().search(search_params.filter.toLowerCase())) {
        return false;
    }

    // Does block match age range?
    var age = FL_ASL.getAge(el);
    // Did we supply a minimum age?
    if (search_params.age.min && (search_params.age.min > age) ) {
        return false;
    }
    // Did we supply a maximum age?
    if (search_params.age.max && (search_params.age.max < age) ) {
        return false;
    }

    // Does block match gender/sex selection?
    if (-1 === search_params.sex.indexOf(FL_ASL.getSex(el))) {
        return false;
    }

    // Does block match role orientation selection?
    if (-1 === search_params.role.indexOf(FL_ASL.getRole(el))) {
        return false;
    }

    // All conditions match.
    return true;
};

FL_ASL.getSex = function (el) {
    var x = el.querySelector('.quiet').innerHTML;
    var sex = x.match(/^\d\d(\S*)/);
    return sex[1];
};

FL_ASL.getAge = function (el) {
    var x = el.querySelector('.quiet').innerHTML;
    var age = x.match(/^\d\d/);
    return parseInt(age);
};

FL_ASL.getRole = function (el) {
    var x = el.querySelector('.quiet').innerHTML;
    var role = x.match(/ ?(\S+)?$/);
    return role[1];
};
FL_ASL.getLocationString = function (el) {
    return el.querySelector('em').innerHTML;
};

FL_ASL.displayResult = function (el) {
    var id = el.querySelector('a').getAttribute('href').match(/\d+$/);
    var name = el.querySelector('.large a').childNodes[0].nodeValue;
    var a = document.createElement('a');
    a.href = 'https://fetlife.com/conversations/new?with=' + id;
    a.innerHTML = '(send ' + name + ' a message)';
    a.style.textDecoration = 'underline';
    a.setAttribute('target', '_blank');
    el.appendChild(a);
    document.getElementById('fetlife_asl_search_results').appendChild(el);
};

FL_ASL.getActivateSearchButton = function () {
    var el = document.getElementById('fetlife_asl_search');
    if (!el) {
        el = FL_ASL.createActivateSearchButton();
    }
    return el;
};
FL_ASL.createActivateSearchButton = function () {
    var label = document.createElement('label');
    label.innerHTML = 'A/S/L?';
    var input = document.createElement('input');
    input.setAttribute('style', '-webkit-appearance: checkbox');
    input.setAttribute('type', 'checkbox');
    input.setAttribute('id', 'fetlife_asl_search');
    input.setAttribute('name', 'fetlife_asl_search');
    input.setAttribute('value', '1');
    input.addEventListener('click', FL_ASL.toggleAslSearch);
    label.appendChild(input);
    return label;
};
FL_ASL.createTabList = function () {
    var ul = document.createElement('ul');
    ul.setAttribute('class', 'tabs');
    html_string = '<li data-fl-asl-section-id="fetlife_asl_search_about"><a href="#">About FetLife ASL Search ' + GM_info.script.version + '</a></li>';
    html_string += '<li class="in_section" data-fl-asl-section-id="fetlife_asl_search_extended"><a href="#">Extended A/S/L search</a></li>';
    html_string += '<li data-fl-asl-section-id="fetlife_asl_search_classic"><a href="#">Classic (slow) search</a></li>';
    ul.innerHTML = html_string;
    ul.addEventListener('click', function (e) {
        var id_to_show = jQuery(e.target.parentNode).data('fl-asl-section-id');
        jQuery('#fetlife_asl_search_ui_container ul.tabs li').each(function (e) {
            if (id_to_show === jQuery(this).data('fl-asl-section-id')) {
                jQuery(this).addClass('in_section');
                jQuery('#' + id_to_show).slideDown();
            } else {
                jQuery(this).removeClass('in_section');
                jQuery('#' + jQuery(this).data('fl-asl-section-id')).slideUp();
            }
        });
    });
    return ul;
};

FL_ASL.createSearchTab = function (id, html_string) {
    var div = document.createElement('div');
    div.setAttribute('id', id);
    div.innerHTML = html_string + FL_UI.Text.donation_appeal;
    return div;
};

FL_ASL.importHtmlString = function (html_string, selector) {
    var external_dom = new DOMParser().parseFromString(html_string, 'text/html');
    var doc_part = external_dom.querySelector(selector);
    return document.importNode(doc_part, true);
};

FL_ASL.updateUserLocation = function () {
    GM_deleteValue('currentUser.profile_html');
    FL_ASL.loadUserProfileHtml(FL_ASL.drawUserLocationSearchLabels);
};

FL_ASL.drawUserLocationSearchLabels = function () {
    var user_loc = FL_ASL.ProfileScraper.getLocation(
        FL_ASL.importHtmlString(FL_ASL.getUserProfileHtml(), '#profile')
    );
    jQuery('#fl_asl_search_loc_fieldset label span').each(function () {
        switch (this.previousElementSibling.value) {
            case 'country':
                this.textContent = user_loc.country;
                break;
            case 'area_id':
                this.textContent = user_loc.region;
                break;
            case 'city_id':
                this.textContent = user_loc.locality;
                break;
        }
    });
};

FL_ASL.attachSearchForm = function () {
    var html_string;
    var user_loc = FL_ASL.ProfileScraper.getLocation(
        FL_ASL.importHtmlString(FL_ASL.getUserProfileHtml(), '#profile')
    );
    var label = FL_ASL.getActivateSearchButton();

    var container = document.createElement('div');
    container.setAttribute('id', 'fetlife_asl_search_ui_container');
    container.setAttribute('style', 'display: none;');

    container.appendChild(FL_ASL.createTabList());

    // "About FetLife ASL Search" tab
    html_string = '<p>The FetLife Age/Sex/Location Search user script allows you to search for profiles on <a href="https://fetlife.com/">FetLife</a> by age, sex, location, or orientation. This user script implements what is, as of this writing, the <a href="https://fetlife.com/improvements/78">most popular suggestion in the FetLife suggestion box</a>:</p>';
    html_string += '<blockquote><p>Search for people by Location/Sex/Orientation/Age</p><p>Increase the detail of the kinkster search by allowing us to narrow the definition of the search by the traditional fields.</p></blockquote>';
    html_string += '<p>With the FetLife Age/Sex/Location Search user script installed, a few clicks will save hours of time. Now you can find profiles that match your specified criteria in a matter of seconds. The script even lets you send a message to the profiles you found right from the search results list.</p>';
    html_string += '<p>Stay up to date with the <a href="https://github.com/meitar/fetlife-aslsearch/">latest FetLife ASL Search improvements</a>. New versions add new features and improve search performance.</p>';
    container.appendChild(FL_ASL.createSearchTab('fetlife_asl_search_about', html_string));

    // Extended search tab
    html_string = '<div id="fetlife_asl_search_extended_wrapper">';
    html_string += '<div><button id="fetlife_asl_search_extended_enlarge">Enlarge</button></div>'
    html_string += '<iframe id="fetlife_asl_search_extended_iframe" src="' + FL_ASL.CONFIG.gasapp_url + '"';
    html_string += ' style="width: 100%; min-height: 400px;">';
    html_string += 'Your browser does not support the <code>&lt;iframe&gt;</code> element, which is required for FetLife A/S/L Extended search.';
    html_string += '</iframe>';
    if (!FL_ASL.CONFIG.debug) {
        html_string += '<div id="fetlife_asl_search_extended_cover">FetLife A/S/L Search (Extended Edition)</div>';
    }
    html_string += '</div><!-- #fetlife_asl_search_extended_wrapper -->';
    var newdiv = container.appendChild(FL_ASL.createSearchTab('fetlife_asl_search_extended', html_string));
    // Google Chrome is far stricter about iframes, so just offer a pop-out instead, for now.
    if (window.navigator.vendor.match(/Google/)) {
        jQuery(newdiv).find('#fetlife_asl_search_extended_enlarge').remove();
        jQuery(newdiv).find('#fetlife_asl_search_extended_cover').remove();
        jQuery(newdiv).find('#fetlife_asl_search_extended_wrapper').html('<h2><a href="#">Open Extended A/S/L Search</a></h2>').on('click', function () {
            GM_openInTab(FL_ASL.CONFIG.gasapp_url.split('?')[0]);
            jQuery('[data-fl-asl-section-id="fetlife_asl_search_about"]').click();
        });
        jQuery(newdiv).find('#fetlife_asl_search_extended_iframe').remove();
    } else {
        jQuery(newdiv).find('#fetlife_asl_search_extended_enlarge').on('click', function () {
            var iframe = jQuery('#fetlife_asl_search_extended_iframe');
            var cover = jQuery('#fetlife_asl_search_extended_cover');
            jQuery(this).after('<button>&times; Close FetLife ASL Search</button>').next('button').on('click', function () {
                iframe.css({
                    'position': 'static',
                    'height': '400px',
                    'width': '950px'
                });
                cover.css({
                    'position': 'absolute',
                    'width': '950px',
                    'top': '23px',
                    'text-align': 'left'
                });
                jQuery(this).remove();
            }).css({'position':'fixed', 'z-index':'9999', 'top': 0, 'left': 0});
            iframe.css({
                'position': "fixed",
                'bottom':   "0",
                'left':     "0",
                'z-index':  "8888",
                'margin':   "0",
                'height':   "100%",
                'border':   "none"
            });
            iframe.width(jQuery(window).width());
            cover.css({
                'position': 'fixed',
                'top': '0',
                'z-index': '8890',
                'width': '100%',
                'text-align': 'center'
            });
        });
    }


    // Main ASL search option interface
    html_string = '<fieldset><legend>Search for user profiles of the following gender/sex:</legend><p>';
    html_string += 'Show me profiles of people with a gender/sex of&hellip;';
    html_string += '<label><input type="checkbox" name="user[sex]" value="M" checked="checked" /> Male</label>';
    html_string += '<label><input type="checkbox" name="user[sex]" value="F" /> Female</label>';
    html_string += '<label><input type="checkbox" name="user[sex]" value="CD/TV" />Crossdresser/Transvestite</label>';
    html_string += '<label><input type="checkbox" name="user[sex]" value="MtF" />Trans - Male to Female</label>';
    html_string += '<label><input type="checkbox" name="user[sex]" value="FtM" checked="checked" />Trans - Female to Male</label>';
    html_string += '<label><input type="checkbox" name="user[sex]" value="TG" />Transgender</label>';
    html_string += '<label><input type="checkbox" name="user[sex]" value="GF" />Gender Fluid</label>';
    html_string += '<label><input type="checkbox" name="user[sex]" value="GQ" />Genderqueer</label>';
    html_string += '<label><input type="checkbox" name="user[sex]" value="IS" />Intersex</label>';
    html_string += '<label><input type="checkbox" name="user[sex]" value="B" />Butch</label>';
    html_string += '<label><input type="checkbox" name="user[sex]" value="FEM" />Femme</label>';
    html_string += '</p></fieldset>';
    html_string += '<fieldset><legend>Search for user profiles between the ages of:</legend><p>';
    html_string += '&hellip;who are also <label>at least <input type="text" name="min_age" id="min_age" placeholder="18" size="2" /> years old</label> and <label>at most <input type="text" name="max_age" id="max_age" placeholder="92" size="2" /> years old&hellip;</label>';
    html_string += '</p></fieldset>';
    html_string += '<fieldset><legend>Search for user profiles whose role is:</legend><p>';
    html_string += '&hellip;who identify their role as ';
    // Note that these values are what show up, not necessarily what's sent to the FetLife backend.
    html_string += '<label><input type="checkbox" name="user[role]" value="Dom" />Dominant</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="Domme" />Domme</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="Switch" />Switch</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="sub" checked="checked" />submissive</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="Master" />Master</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="Mistress" />Mistress</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="slave" checked="checked" />slave</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="pet" checked="checked" />pet</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="kajira" />kajira</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="kajirus" />kajirus</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="Top" />Top</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="bottom" checked="checked" />Bottom</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="Sadist" />Sadist</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="Masochist" checked="checked" />Masochist</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="Sadomasochist" />Sadomasochist</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="Ageplayer" />Ageplayer</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="Daddy" />Daddy</label>';	
    html_string += '<label><input type="checkbox" name="user[role]" value="babygirl" />babygirl</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="brat" />brat</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="Primal" />Primal</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="Fetishist" />Fetishist</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="Kinkster" />Kinkster</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="Hedonist" />Hedonist</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="Vanilla" />Vanilla</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="Unsure" />Unsure</label>';
    html_string += '<label><input type="checkbox" name="user[role]" value="" />Not Applicable</label>';
    html_string += '</p></fieldset>';
    html_string += '<fieldset id="fl_asl_search_loc_fieldset"><legend>Search for user profiles located in:</legend><p>';
    html_string += '&hellip;from ';
    // If we're on a "groups" or "events" or "user" or "fetish" or "search" page,
    var which_thing = window.location.toString().match(/(group|event|user|fetish)e?s\/(\d+)/) || window.location.toString().match(/(search)\/kinksters\/?\?(?:page=\d+&)?q=(\S+)/);
    if (null !== which_thing) {
        switch (which_thing[1]) {
            case 'user':
                var label_text = "user's friends";
                break;
            case 'group': // fall through
            case 'event':
            case 'fetish':
            case 'search':
            default:
                var label_text = which_thing[1];
                break;
        }
        // offer an additional option to search for users associated with this object rather than geography.
        html_string += '<label><input type="radio" name="fl_asl_loc" value="' + which_thing[1] + '" data-flasl' + which_thing[1] + 'id="' + which_thing[2] + '"/>this ' + label_text + '</label>';
        html_string += '<label id="fl_asl_loc_filter_label" style="display: none;"> located in <input type="text" id="fl_asl_loc_filter" name="fl_asl_loc_filter" /></label>';
        html_string += ', or ';
    }
    html_string += ' my <label><input type="radio" name="fl_asl_loc" value="city_id" />city (<span>' + user_loc.locality + '</span>)</label>';
    html_string += '<label><input type="radio" name="fl_asl_loc" value="area_id" checked="checked" />state/province (<span>' + user_loc.region + '</span>)</label>';
    html_string += '<label><input type="radio" name="fl_asl_loc" value="country" />country (<span>' + user_loc.country + '</span>)</label>';
    html_string += '. <abbr title="If you changed the location on your profile, click the &ldquo;Update your location&rdquo; button to set FetLife ASL Search to your new location. You can also choose a search set other than your profile location when you load FetLife ASL Search on certain pages that imply their own search set, such as a user profile (for searching a friends list) a group page (for searching group members) an event (for searching RSVPs), or a fetish (for searching kinksters with that fetish). You can then further filter the results from the friend list, event RSVPs, etc. based on the name of a city, state/province, or country."></abbr></p></fieldset>';
    html_string += '<fieldset><legend>Result set options:</legend><p>';
    html_string += '<label>Return at least <input id="fl_asl_min_matches" name="fl_asl_min_matches" value="" placeholder="1" size="2" /> matches per search.</label> (Set this lower if no results seem to ever appear.)';
    html_string += '</p></fieldset>';
    html_string += '<fieldset><legend>Search speed options:</legend><p>';
    html_string += '<label>Online search speed: Aggressive (faster) <input id="fl_asl_search_sleep_interval" name="fl_asl_search_sleep_interval" type="range" min="0" max="10" step="0.5" value="' + FL_ASL.CONFIG.search_sleep_interval + '" /> Stealthy (slower)</label>';
    html_string += '<br />(Wait <output name="fl_asl_search_sleep_interval" for="fl_asl_search_sleep_interval">' +  FL_ASL.CONFIG.search_sleep_interval + '</output> seconds between searches.) <abbr title="FetLife has begun banning accounts that search with this script too quickly. An aggressive search is faster, but riskier. A stealthier search is slower, but safer."></span>';
    html_string += '</p></fieldset>';
    var div = FL_ASL.createSearchTab('fetlife_asl_search_classic', html_string);
    div.querySelector('input[name="fl_asl_search_sleep_interval"]').addEventListener('input', function (e) {
        div.querySelector('output[name="fl_asl_search_sleep_interval"]').value = this.value;
    });
    // Help buttons
    FL_UI.Dialog.createLink(
        'fl_asl_loc-help',
        '(Update location.)',
        div.querySelector('#fl_asl_search_loc_fieldset abbr')
    );
    html_string = '<p><a id="btn_fetlife_asl_update_location" class="btnsqr close" data-closes-modal="fl_asl_loc-help">Update your location</a></p>';
    html_string += '<p>' + div.querySelector('#fl_asl_search_loc_fieldset abbr').getAttribute('title') + '</p>';
    FL_UI.Dialog.inject(
        'fl_asl_loc-help',
        'Change location',
        html_string
    );
    document.getElementById('btn_fetlife_asl_update_location').addEventListener('click', FL_ASL.updateUserLocation);
    FL_UI.Dialog.createLink(
        'fl_asl_search_sleep_interval-help',
        '(Help with online search speed.)',
        div.querySelector('output[name="fl_asl_search_sleep_interval"] + abbr')
    );
    FL_UI.Dialog.inject(
        'fl_asl_search_sleep_interval-help',
        'About &ldquo;Online search speed&rdquo;',
        div.querySelector('output[name="fl_asl_search_sleep_interval"] + abbr').getAttribute('title')
    );
    container.appendChild(div);
    FL_ASL.CONFIG.search_form.appendChild(label);
    FL_ASL.CONFIG.search_form.appendChild(container);
    var radio_els = document.querySelectorAll('input[name="fl_asl_loc"]');
    for (var i = 0; i < radio_els.length; i++) {
        radio_els[i].addEventListener('click', FL_ASL.toggleLocationFilter);
    }

    btn_submit = document.createElement('button');
    btn_submit.setAttribute('id', 'btn_fetlife_asl_search_submit');
    btn_submit.setAttribute('onclick', "var xme = document.getElementById('btn_fetlife_asl_search_submit'); xme.parentNode.removeChild(xme); return false;");
    btn_submit.innerHTML = 'Mine! (I mean, uh, search&hellip;)';
    btn_submit.addEventListener('click', FL_ASL.aslSubmit);
    div.appendChild(btn_submit);

    results_container = document.createElement('div');
    results_container.setAttribute('id', 'fetlife_asl_search_results');
    FL_ASL.CONFIG.search_form.appendChild(results_container);

    prog = document.createElement('p');
    prog.setAttribute('id', FL_ASL.CONFIG.progress_id);
    FL_ASL.CONFIG.search_form.appendChild(prog);
};

// ****************************************************
//
// Google Apps Script interface
//
// ****************************************************
FL_ASL.GAS = {};
FL_ASL.GAS.ajaxPost = function (data)  {
    FL_ASL.log('POSTing profile data for ' + data.nickname + ' (' + data.user_id + ')');
    var url = (FL_ASL.CONFIG.debug)
        ? FL_ASL.CONFIG.gasapp_url_development
        : FL_ASL.CONFIG.gasapp_url;
    GM_xmlhttpRequest({
        'method': 'POST',
        'url': url,
        'data': 'post_data=' + encodeURIComponent(JSON.stringify(data)),
        'headers': {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        'onload': function (response) {
            FL_ASL.log('POST response received: ' + response.responseText);
        }
    });
};

// ****************************************************
//
// Scrapers
//
// ****************************************************
FL_ASL.ProfileScraper = {};
FL_ASL.ProfileScraper.getNickname = function () {
    return jQuery('#main_content h2').first().text().split(' ')[0];
};
FL_ASL.ProfileScraper.getAge = function () {
    var x = $x('//h2/*[@class[contains(., "quiet")]]');
    var ret;
    if (x.length) {
        y = x[0].textContent.match(/^\d+/);
        if (y) {
            ret = y[0];
        }
    }
    return ret;
};
FL_ASL.ProfileScraper.getGender = function () {
    var x = $x('//h2/*[@class[contains(., "quiet")]]');
    var ret = '';
    if (x.length) {
        y = x[0].textContent.match(/[^\d ]+/);
        if (y) {
            ret = y[0];
        }
    }
    return ret;
};
FL_ASL.ProfileScraper.getRole = function (body) {
    var x = $x('//h2/*[@class[contains(., "quiet")]]');
    var ret = '';
    if (x.length) {
        y = x[0].textContent.match(/ .+/);
        if (y) {
            ret = y[0].trim();
        }
    }
    return ret;
};
FL_ASL.ProfileScraper.getFriendCount = function (body) {
    var x = $x('//h4[starts-with(., "Friends")]');
    var ret = 0;
    if (x.length) {
        ret = x[0].textContent.match(/\(([\d,]+)\)/)[1].replace(',', '');
    }
    return ret;
};
FL_ASL.ProfileScraper.isPaidAccount = function () {
    return (document.querySelector('.fl-badge')) ? true : false;
};
FL_ASL.ProfileScraper.getLocation = function (dom) {
    var dom = dom || document;
    var x = $x('//h2[@class="bottom"]/following-sibling::p//a', dom);
    var ret = {
        'locality': '',
        'region': '',
        'country': ''
    };
    if (3 === x.length) {
        ret['country'] = x[2].textContent;
        ret['region'] = x[1].textContent;
        ret['locality'] = x[0].textContent;
    } else if (2 === x.length) {
        ret['country'] = x[1].textContent;
        ret['region'] = x[0].textContent;
    } else if (1 === x.length) {
        ret['country'] = x[0].textContent;
    }
    return ret;
};
FL_ASL.ProfileScraper.getAvatar = function () {
    var el = document.querySelector('.pan');
    var ret;
    if (el) {
        ret = el.src;
    }
    return ret;
};
FL_ASL.ProfileScraper.getSexualOrientation = function () {
    var x = $x('//table//th[starts-with(., "orientation")]/following-sibling::td');
    var ret = '';
    if (x.length) {
        ret = x[0].textContent.trim();
    }
    return ret;
};
FL_ASL.ProfileScraper.getInterestLevel = function () {
    var x = $x('//table//th[starts-with(., "active")]/following-sibling::td');
    var ret = [];
    if (x.length) {
        ret = x[0].textContent.trim();
    }
    return ret;
};
FL_ASL.ProfileScraper.getLookingFor = function () {
    var x = $x('//table//th[starts-with(., "is looking for")]/following-sibling::td');
    var ret = [];
    if (x.length) {
        ret = x[0].innerHTML.split('<br>');
    }
    return ret;
};
FL_ASL.ProfileScraper.getRelationships = function () {
    var x = $x('//table//th[starts-with(., "relationship status")]/following-sibling::td//a');
    var ret = [];
    for (var i = 0; i < x.length; i++) {
        ret.push(x[i].href.match(/\d+$/)[0]);
    }
    return ret;
};
FL_ASL.ProfileScraper.getDsRelationships = function () {
    var x = $x('//table//th[starts-with(., "D/s relationship status")]/following-sibling::td//a');
    var ret = [];
    for (var i = 0; i < x.length; i++) {
        ret.push(x[i].href.match(/\d+$/)[0]);
    }
    return ret;
};
FL_ASL.ProfileScraper.getBio = function () {
    var html = '';
    jQuery($x('//h3[@class][starts-with(., "About me")]')).nextUntil('h3.bottom').each(function () {
        html += jQuery(this).html();
    });
    return html;
};
FL_ASL.ProfileScraper.getWebsites = function () {
    var x = $x('//h3[@class="bottom"][starts-with(., "Websites")]/following-sibling::ul[1]//a');
    var ret = [];
    for (var i = 0; i < x.length; i++) {
        ret.push(x[i].textContent.trim());
    }
    return ret;
};
FL_ASL.ProfileScraper.getLastActivity = function () {
    // TODO: Convert this relative date string to a timestamp
    var x = document.querySelector('#mini_feed .quiet');
    var ret;
    if (x) {
        ret = x.textContent.trim();
    }
    return ret;
};
FL_ASL.ProfileScraper.getFetishesInto = function () {
    var x = $x('//h3[@class="bottom"][starts-with(., "Fetishes")]/following-sibling::p[1]//a');
    var ret = [];
    for (var i = 0; i < x.length; i++) {
        ret.push(x[i].textContent.trim());
    }
    return ret;
};
FL_ASL.ProfileScraper.getFetishesCuriousAbout = function () {
    var x = $x('//h3[@class="bottom"][starts-with(., "Fetishes")]/following-sibling::p[2]//a');
    var ret = [];
    for (var i = 0; i < x.length; i++) {
        ret.push(x[i].textContent.trim());
    }
    return ret;
};
FL_ASL.ProfileScraper.getPicturesCount = function () {
    var el = document.getElementById('user_pictures_link');
    var ret = 0;
    if (el) {
        ret = el.nextSibling.textContent.match(/\d+/)[0];
    }
    return ret;
};
FL_ASL.ProfileScraper.getVideosCount = function () {
    var el = document.getElementById('user_videos_link');
    var ret = 0;
    if (el) {
        ret = el.nextSibling.textContent.match(/\d+/)[0];
    }
    return ret;
};
FL_ASL.ProfileScraper.getLatestPosts = function () {
    // TODO:
};
FL_ASL.ProfileScraper.getGroupsLead = function () {
    // TODO:
};
FL_ASL.ProfileScraper.getGroupsMemberOf = function () {
    // TODO:
};
FL_ASL.ProfileScraper.getEventsGoingTo = function () {
    // TODO:
};
FL_ASL.ProfileScraper.getEventsMaybeGoingTo = function () {
    // TODO:
};

FL_ASL.scrapeProfile = function (user_id) {
    if (!window.location.pathname.endsWith(user_id)) {
        FL_ASL.log('Profile page does not match ' + user_id);
        return false;
    }
    var profile_data = {
        'user_id': user_id,
        'nickname': FL_ASL.ProfileScraper.getNickname(),
        'age': FL_ASL.ProfileScraper.getAge(),
        'gender': FL_ASL.ProfileScraper.getGender(),
        'role': FL_ASL.ProfileScraper.getRole(),
        'friend_count': FL_ASL.ProfileScraper.getFriendCount(),
        'paid_account': FL_ASL.ProfileScraper.isPaidAccount(),
        'location_locality': FL_ASL.ProfileScraper.getLocation().locality,
        'location_region': FL_ASL.ProfileScraper.getLocation().region,
        'location_country': FL_ASL.ProfileScraper.getLocation().country,
        'avatar_url': FL_ASL.ProfileScraper.getAvatar(),
        'sexual_orientation': FL_ASL.ProfileScraper.getSexualOrientation(),
        'interest_level': FL_ASL.ProfileScraper.getInterestLevel(),
        'looking_for': FL_ASL.ProfileScraper.getLookingFor(),
        'relationships': FL_ASL.ProfileScraper.getRelationships(),
        'ds_relationships': FL_ASL.ProfileScraper.getDsRelationships(),
        'bio': FL_ASL.ProfileScraper.getBio(),
        'websites': FL_ASL.ProfileScraper.getWebsites(),
        'last_activity': FL_ASL.ProfileScraper.getLastActivity(),
        'fetishes_into': FL_ASL.ProfileScraper.getFetishesInto(),
        'fetishes_curious_about': FL_ASL.ProfileScraper.getFetishesCuriousAbout(),
        'num_pics': FL_ASL.ProfileScraper.getPicturesCount(),
        'num_vids': FL_ASL.ProfileScraper.getVideosCount(),
        'latest_posts': FL_ASL.ProfileScraper.getLatestPosts(),
        'groups_lead': FL_ASL.ProfileScraper.getGroupsLead(),
        'groups_member_of': FL_ASL.ProfileScraper.getGroupsMemberOf(),
        'events_going_to': FL_ASL.ProfileScraper.getEventsGoingTo(),
        'events_maybe_going_to': FL_ASL.ProfileScraper.getEventsMaybeGoingTo()
    };
    FL_ASL.GAS.ajaxPost(profile_data);
}
FL_ASL.scrapeUserInList = function (node) {
    // Deal with location inconsistencies.
    var loc_parts = jQuery(node).find('.small').first().text().split(', ');
    var locality = ''; var region = ''; var country = '';
    if (2 === loc_parts.length) {
        locality = loc_parts[0];
        region   = loc_parts[1];
    } else if (1 === loc_parts.length) {
        country = loc_parts[0];
    }

    var profile_data = {
        'user_id': jQuery(node).find('a').first().attr('href').match(/\d+$/)[0],
        'nickname': jQuery(node).find('img').first().attr('alt'),
        'age': jQuery(node).find('.quiet').first().text().match(/^\d+/)[0],
        'gender': jQuery(node).find('.quiet').first().text().match(/([^0-9]+) /)[1],
        'role': jQuery(node).find('.quiet').first().text().match(/ (.*)$/)[1],
        'location_locality': locality,
        'location_region': region,
        'location_country': country,
        'avatar_url': jQuery(node).find('img').first().attr('src')
    };
    for (var k in profile_data) {
        if ('' === profile_data[k]) {
            delete profile_data[k];
        }
    }
    FL_ASL.GAS.ajaxPost(profile_data);
};
FL_ASL.scrapeAnchoredAvatar = function (node) {
    var profile_data = {
        'user_id': jQuery(node).attr('href').match(/\d+$/)[0],
        'nickname': jQuery(node).find('img').first().attr('alt'),
        'avatar_url': jQuery(node).find('img').first().attr('src')
    };
    FL_ASL.GAS.ajaxPost(profile_data);
};

// This is the main() function, executed on page load.
FL_ASL.main = function () {
    // Insert ASL search button interface at FetLife "Search" bar.
    FL_ASL.attachSearchForm();

    var m;
    if (m = window.location.pathname.match(/users\/(\d+)/)) {
        FL_ASL.log('Scraping profile ' + m[1]);
        FL_ASL.scrapeProfile(m[1]);
    }
    if (document.querySelectorAll('.user_in_list').length) {
        jQuery('.user_in_list').each(function () {
            FL_ASL.scrapeUserInList(this);
        });
    }
    if (document.querySelectorAll('a.avatar').length) {
        jQuery('a.avatar').each(function () {
            FL_ASL.scrapeAnchoredAvatar(this);
        });
    }
};

FAADE = {};
FAADE.CONFIG = {
    'debug': false, // switch to true to debug.
    'gdocs_key': '0ArYmNHuRadHbdGNVT1kzSzFnOXhHRjh1RnczZVVmMXc',
    'gform_key': 'dGNVT1kzSzFnOXhHRjh1RnczZVVmMXc6MQ',
    'gdocs_development_key': '0ArYmNHuRadHbdGxjMUhyR0FzLWJicHNXUFdxckFEQWc',
    'gform_development_key': 'dGxjMUhyR0FzLWJicHNXUFdxckFEQWc6MQ',
};

// Utility debugging function.
FAADE.log = function (msg) {
    if (!FAADE.CONFIG.debug) { return; }
    GM_log('FETLIFE FAADE: ' + msg);
    //console.log('FETLIFE FAADE: ' + msg);
};

// Initializations.
var uw = (unsafeWindow) ? unsafeWindow : window ; // Help with Chrome compatibility?
GM_addStyle('\
/* Highlight alleged abusers in bright yellow. */\
.faade_alleged_abuser {\
    display: inline-block;\
    border: 2px solid yellow;\
}\
#faade_abuse_reports caption {\
    background: yellow;\
    color: red;\
}\
#faade_abuse_reports tfoot td {\
    padding-top: 1em;\
    text-align: center;\
}\
#faade_abuse_reports tr:target > * {\
    border: 1px solid red;\
}\
#faade_abuse_reports tr:target th {\
    border-width: 1px 0 1px 1px;\
}\
#faade_abuse_reports tr:target td {\
    border-width: 1px 1px 1px 0;\
}\
/* FAADE location broadcast dialog styles. */\
[aria-labelledby="ui-dialog-title-faade"] { border-color: yellow; }\
#ui-dialog-title-faade { color: red; }\
/* General prettiness. */\
#profile #main_content a + a.faade_report_link { padding-left: 5px; }\
footer .faade_report_link,\
.blog_entry p.quiet.small .faade_report_link,\
.byline .faade_report_link {\
    display: block;\
    color: #777;\
}\
.mini_feed_title .faade_report_link {\
    float: left;\
    padding-right: 5px;\
}\
ul.pictures li a.faade_report_link,\
#profile ul.friends li { width: auto; }\
');
FAADE.init = function () {
    // Whenever we load CreepShield, just clear the cookies.
    if (window.location.hostname.match(/creepshield.com/)) {
        FAADE.clearCookies();
        return;
    }
    FL_ASL.getUserProfileHtml(uw.FetLife.currentUser.id); // run early
    FAADE.injectDialog();
    FAADE.abuser_database = FAADE.getValue('abuser_database', false);
    if (FAADE.abuserDatabaseExpired()) {
        FAADE.fetchAbuserDatabase();
    }
    FAADE.main();
};
window.addEventListener('DOMContentLoaded', FAADE.init);

// Determines whether the abuser database has expired and needs to be re-fetched.
FAADE.abuserDatabaseExpired = function () {
    // If we don't have a database, then of course it's "expired."
    if (!FAADE.abuser_database) {
        FAADE.log('Abuser database expired because of false-equivalent value.');
        return true;
    } else if ( (new Date().getTime() > (parseInt(FAADE.getValue('last_fetch_time')) + 86400)) ) {
        // Abuser database was last fetched more than 24 hours (86400 seconds) ago, so refresh.
        FAADE.log('Abuser database expired because of time.');
        return true;
    } else {
        FAADE.log('Abuser database still fresh.');
        return false;
    }
};

FAADE.getDatabaseConnectionString = function () {
    return (FAADE.CONFIG.debug) ?
        FAADE.CONFIG.gdocs_development_key :
        FAADE.CONFIG.gdocs_key;
};
FAADE.getReportFormKey = function () {
    return (FAADE.CONFIG.debug) ?
        FAADE.CONFIG.gform_development_key :
        FAADE.CONFIG.gform_key;
};

FAADE.setValue = function (x, y) {
    return (FAADE.CONFIG.debug) ?
        GM_setValue(x += '_development', y) :
        GM_setValue(x, y);
};
FAADE.getValue = function (x, y) {
    if (arguments.length === 1) {
        return (FAADE.CONFIG.debug) ?
            GM_getValue(x += '_development'):
            GM_getValue(x);
    } else {
        return (FAADE.CONFIG.debug) ?
            GM_getValue(x += '_development', y):
            GM_getValue(x, y);
    }
};

FAADE.fetchAbuserDatabase = function () {
    var key = FAADE.getDatabaseConnectionString();
    var url = 'https://docs.google.com/spreadsheet/pub?key=' + key + '&output=html';
    FAADE.log('fetching abusers database from ' + url);
    GM_xmlhttpRequest({
        'method': 'GET',
        'url': url,
        'onload': function (response) {
            if (!response.finalUrl.match(/^https:\/\/docs.google.com\/spreadsheet\/pub/)) {
                FAADE.log('Failed to fetch abuser database from ' + url);
                return false;
            }
            FAADE.setValue('last_fetch_time', new Date().getTime().toString()); // timestamp this fetch
            FAADE.setValue('abuser_database', response.responseText);
            FAADE.abuser_database = FAADE.getValue('abuser_database');
        }
    });
};

FAADE.injectDialog = function () {
    FL_UI.Dialog.createLink('faade', '', document.body);
    var html_string = '<p class="mbm">There have been <span id="faade_reports_to_alert">X</span> new consent violations filed to the Predator Alert Tool for FetLife that may have been perpetrated near your location (<span id="faade_user_loc">X, X, X</span>).</p>';
    html_string += '<p>Click "View new nearby PAT-FetLife reports" to view the profiles of the people who have been accused of consent violations near your area in new tabs.</p>';
    html_string += '<p id="faade-actions" class="ac">';
    html_string += '<a rel="nofollow" class="btnsqr close" data-closes-modal="faade" href="#">View new nearby PAT-FetLife reports</a>';
    html_string += '<span class="i s q">&nbsp;-or-&nbsp;</span>';
    html_string += '<a data-closes-modal="faade" class="close tdn q" href="#">Cancel</a>';
    html_string += '</p>';
    html_string += '<p>(Don\'t worry, I\'m not looking for where you actually are. Your location was determined from your FetLife profile.)</p>';
    FL_UI.Dialog.inject(
        'faade',
        'Predator Alert Tool for FetLife (PAT-FetLife)',
        html_string
    );
};

FAADE.getLocationFromProfileHtml = function (html) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    return doc.querySelector('h2.bottom + p > em').textContent.split(', '); // split with comma AND space
};

FAADE.broadcastNewProximalReports = function (doc) {
    // Recall timestamp of last record checked.
    var last_timestamp_checked = parseInt(FAADE.getValue('last_timestamp_checked', '0')); // default is "never!"
    // Get latest timestamp in stored alleged abuser database.
    var rows = doc.querySelectorAll('#tblMain tr'); // read in every report, in full
    var latest_timestamp_filed = Date.parse(rows[rows.length - 1].childNodes[1].textContent);

    // If never checked, or if there are new records since last timestamp checked
    if (last_timestamp_checked < latest_timestamp_filed) {
        FAADE.log('Last timestamp checked (' + last_timestamp_checked.toString() + ') is older than latest timestamp filed (' + latest_timestamp_filed.toString() + ').');

        // count how many new records there are since last check
        var num_reports = 0;
        for (var i = rows.length - 1; i > 0; i--) {
            if (Date.parse(rows[i].childNodes[1].textContent) > last_timestamp_checked) {
                num_reports++;
            } else {
                break; // we've reached the timestamps we've already checked, we're done
            }
        }
        FAADE.log('Total of ' + num_reports + ' new reports since last check.');

        var user_loc = FAADE.getLocationFromProfileHtml(FL_ASL.getUserProfileHtml());
        FAADE.log('Current user location seems to be ' + user_loc.join(', ') + '.');

        // Loop over all new records one by one
        var reports_to_alert = [];
        for (var i = rows.length - num_reports; i <= rows.length - 1; i++) {
            // extract the location data from the report
            report_loc = rows[i].childNodes[6].textContent;
            // compare current user's FetLife profile location against alleged abuse location
            // and test each substring of the user profile against the reported location
            for (var z = 0; z < user_loc.length; z++) {
                // if a relevant case insensitive substring matches
                if (-1 !== report_loc.toLowerCase().search(user_loc[z].toLowerCase())) {
                    FAADE.log('Filed report location ' + report_loc + ' matches user location substring ' + user_loc[z] + '!');
                    // store for future pop-up
                    reports_to_alert.push(rows[i]);
                    break; // we found a match, so stop trying on this row
                }
            }
        }

        // Ask user to view the profiles of the alleged abusers in the user's local vicinity.
        if (reports_to_alert.length) {
            // Fill in the user-facing message with the appropriate info.
            document.getElementById('faade_reports_to_alert').innerHTML = reports_to_alert.length.toString();
            document.getElementById('faade_user_loc').innerHTML = user_loc.join(', ');
            // Create the click event we're going to use.
            var evt = document.createEvent('MouseEvents');
            evt.initEvent('click', true, false); // can bubble, can't be cancelled
            // "Click" event on hidden code.
            document.querySelector('a[data-opens-modal="faade"]').dispatchEvent(evt);
            // Attach event listener to "View" button and pass in appropriate URLs.
            document.querySelector('.btnsqr[data-closes-modal="faade"]').addEventListener('click', function () {
                for (var i = 0; i < reports_to_alert.length; i++) {
                    // TODO: Add the permalink to the specific report to this URL, so it's highlighted when opened.
                    var url = 'https://fetlife.com/users/';
                    GM_openInTab(url + reports_to_alert[i].childNodes[2].textContent.match(/\d+/)[0]);
                }
            });
        }
    }

    // Make a note of the latest timestamp filed, so we start here next time we're loaded.
    FAADE.setValue('last_timestamp_checked', latest_timestamp_filed.toString());
};

FAADE.creepShield = {};
FAADE.creepShield.checkPhotoUrl = function (url) {
    // For Chrome, we need to create the multipart request manually because
    // extensions can't decode FormData objects due to its isolated worlds.
    // See http://code.google.com/p/tampermonkey/issues/detail?id=183
    var multipart_boundary = "---xxx111222333444555666777888999";
    var multipart_data = '--' + multipart_boundary + "\n";
    multipart_data += 'Content-Disposition: form-data; name="linked_image"';
    multipart_data += "\n\n";
    multipart_data += url;
    multipart_data += "\n";
    // Mimic hitting the "Search" button.
    multipart_data += '--' + multipart_boundary + "\n";
    multipart_data += 'Content-Disposition: form-data; name="submit_linked_image"';
    multipart_data += "\n\n";
    multipart_data += 'Search';
    multipart_data += "\n";
    multipart_data += '--' + multipart_boundary + '--'; // end

    GM_xmlhttpRequest({
        'method': 'POST',
        'url': 'http://www.creepshield.com/search',
        'headers': {
            'Content-Type': 'multipart/form-data; boundary=' + multipart_boundary
        },
        'data': multipart_data,
        'onload': function (response) {
            var parser = new DOMParser();
            var doc = parser.parseFromString(response.responseText, 'text/html');
            // If our search was successful,
            if (doc.querySelector('.search-details')) {
                // Parse the CreepShield results and display on FetLife.
                var creep_data = FAADE.creepShield.parseResults(doc);
                FAADE.creepShield.displayOnFetLife(creep_data);
            } else {
                FAADE.log('An error occurred searching CreepShield.com.');
                if (doc.getElementById('messages')) {
                    FAADE.creepShield.displayError(doc.getElementById('messages').textContent);
                }
            }
        }
    });
};
FAADE.creepShield.parseResults = function (doc) {
    var ret = {
        'searched_url' : doc.querySelector('.searched-image').getAttribute('src'),
        'matches_count': doc.querySelectorAll('.person').length,
        'highest_match': doc.querySelector('.match-percentage p:nth-child(2)').textContent.match(/\d+%/),
        'highest_photo': doc.querySelector('.person-images-inner img'),
        'person_detail': doc.querySelector('.person-name').textContent
    };
    return ret;
};
FAADE.creepShield.getDisclaimerHtml = function () {
    return '<p>This feature is powered by the facial recognition service at <a href="http://creepshield.com/">CreepShield.com</a>. The registered sex offender database is <em>not</em> always a reliable source of information. <a href="https://www.eff.org/deeplinks/2011/04/sexual-predators-please-check-here-match-com-s">Learn more</a>.</p>';
};
FAADE.creepShield.displayOnFetLife = function (creep_data) {
    var base_el = document.querySelector('.pan').parentNode.parentNode;
    var my_el = document.createElement('div');
    my_el.setAttribute('class', 'pat-fetlife-creepshield-results');
    var html = '<h3>Possible Registered Sex Offender matches:</h3>';
    html += '<ul>';
    html += '<li>Highest facial match: ' + creep_data.highest_match + '</li>'
    html += '<li>Most likely offender: <img src="' + creep_data.highest_photo.getAttribute('src') + '" alt="" />' + creep_data.person_detail + '</li>';
    html += '<li>Total possible matches: ' + creep_data.matches_count + '</li>';
    html += '</ul>';
    html += '<form method="POST" action="http://www.creepshield.com/search">';
    html += '<input type="hidden" name="linked_image" value="' + creep_data.searched_url + '" />';
    html += '<p>Search for criminal histories and other possible offenders: ';
    html += '<input type="submit" name="submit_linked_image" value="Search" />';
    html += '</p>';
    html += '</form>';
    html += FAADE.creepShield.getDisclaimerHtml();
    my_el.innerHTML = html;
    base_el.appendChild(my_el);
};
FAADE.creepShield.displayError = function (msg) {
    var base_el = document.querySelector('.pan').parentNode.parentNode;
    var my_el = document.createElement('div');
    my_el.setAttribute('class', 'pat-fetlife-creepshield-results error');
    var html = '<p>CreepShield returned an error:</p>';
    html += '<blockquote><p>' + msg + '</p></blockquote>';
    html += '<p>If you are being told you need to login before you can do more searches, simply <a href="javascript:window.location.reload();void(0);">reload this page</a> to try again.</p>';
    html += FAADE.creepShield.getDisclaimerHtml();
    my_el.innerHTML = html;
    base_el.appendChild(my_el);
    // If free search limit was hit, go to CreepShield.com to flush it out.
    if (msg.match(/You cannot perform any more searches/i)) {
        GM_openInTab('http://www.creepshield.com/search');
    }
};

FAADE.clearCookies = function () {
    var cookie_list = document.cookie.split(';');
    for (var i = 0; i < cookie_list.length; i++) {
        var cookie_name = cookie_list[i].replace(/\s*(\w+)=.+$/, "$1");
        // To delete a cookie, set its expiration date to a past value.
        document.cookie = cookie_name + '=;expires=Thu, 01-Jan-1970 00:00:01 GMT;';
    }
};

// This is the main() function, executed on page load.
FAADE.main = function () {
    // Make a list of known alleged abuser user IDs.
    var parser = new DOMParser();
    var doc = parser.parseFromString(FAADE.abuser_database, 'text/html');
    var els = doc.querySelectorAll('#tblMain td:nth-child(3)'); // third child is the column of IDs.
    var abuser_ids = [];
    for (var i = 1; i < els.length; i++) { // we never need the first (0'th) cell because Google provides it blank.
        abuser_ids.push(els[i].innerHTML);
    }
    FAADE.log('recalled abuser ids ' + abuser_ids);

    // TODO: Refactor this, it's kludgy.
    setTimeout(function() {
        FAADE.log('Running time-delayed function.');
        if (FL_ASL.getUserProfileHtml()) {
            FAADE.log('We have the current user\'s FetLife profile HTML. Running broadcast checks.');
            FAADE.broadcastNewProximalReports(doc);
        }
    }, 5000); // give us a few seconds to grab the current user's FetLife profile HTML.

    // Are we on a user profile page?
    if (window.location.href.match(/users\/(\d+)\/?$/)) {

        var profile_nick = document.querySelector('h2.bottom').childNodes[0].textContent.match(/\S+/)[0];
        var id_in_url = window.location.href.match(/users\/(\d+)\/?$/)[1];
        var userpic_el = document.querySelector('.pan');
        // If we can grab this person's userpic, send it off to CreepSheild for testing.
        if (userpic_el) {
            var userpic_src = userpic_el.getAttribute('src');
            // This will check and call back to the renderer, so we can move on now.
            FAADE.creepShield.checkPhotoUrl(userpic_src);
        }

        // If we're not viewing our own profile page, insert a report link.
        usr_ops = document.querySelector('#main_content p.quiet');
        if (usr_ops) {
            usr_ops.appendChild(document.createElement('br'));
            usr_ops.appendChild(FAADE.createAbuseReportLink(id_in_url, profile_nick));
        }

        // If this is a profile page of an alleged abuser,
        if (-1 !== abuser_ids.indexOf(id_in_url)) {

            var report_el = document.createElement('table');
            report_el.setAttribute('id', 'faade_abuse_reports');
            report_el.setAttribute('summary', 'Reported consent violations committed by ' + profile_nick + '.');
            var caption = document.createElement('caption');
            caption.innerHTML = 'There are reports ' + profile_nick + ' violated others\' consent in these ways:';
            var tfoot = document.createElement('tfoot');
            tfoot.innerHTML = '<tr><td colspan="2"></td></tr>';
            tfoot.querySelector('td').appendChild(FAADE.createAbuseReportLink(id_in_url, profile_nick));
            report_el.appendChild(caption);
            report_el.appendChild(tfoot);

            // Find all reports that match ID number.
            var abuse_reports = [];
            for (var ix = 0; ix < els.length; ix++) {
                if (id_in_url === els[ix].innerHTML) {
                    abuse_reports.push(els[ix].parentNode); // the table row of abuse report
                }
            }
            // Add this information to the top of this user's profile
            for (var iy = 0; iy < abuse_reports.length; iy++) {
                var num = iy + 1;
                var tr = document.createElement('tr');
                tr.setAttribute('id', 'faade_abuse_report-' + num.toString());
                var details_html = '<ul><li class="faade_abuse_report_datetime">' + abuse_reports[iy].childNodes[7].innerHTML + '</li>';
                details_html += '<li class="faade_abuse_report_location">' + abuse_reports[iy].childNodes[6].innerHTML + '</li></ul>';
                var permalink_html = '<a class="faade_abuse_reported_datetime" rel="bookmark" href="'
                    + window.location + '#faade_abuse_report-' + num.toString()
                    + '" title="Permalink for PAT-FetLife abuse report number ' + num.toString() + ' against '
                    + profile_nick + '.">' +  abuse_reports[iy].childNodes[1].innerHTML + '</a>';
                tr.innerHTML += '<th>Abuse report ' + num.toString() + ' (' + permalink_html + '):' + details_html + '</th>';
                tr.innerHTML += '<td>' + abuse_reports[iy].childNodes[5].innerHTML + '</td>';
                report_el.appendChild(tr);
            }

            var before = document.querySelector('#main_content table:last-child');
            before.parentNode.insertBefore(report_el, before);
        }

    }

    // Collect all user links on this page.
    var user_links = [];
    for (i = 0; i < document.links.length; i++) {
        var l = document.links[i].href.match(/^(https:\/\/fetlife.com)?\/users\/(\d+)\/?$/);
        if ( l && (l[2] !== uw.FetLife.currentUser.id.toString()) ) {
            user_links.push(document.links[i]);
        }
    }

    // For each user ID found,
    var last_id = null;
    for (i = 0; i < user_links.length; i++) {
        // Collect its user ID number.
        var id = user_links[i].href.match(/\d+\/?$/);
        if (id) { id = id.toString(); } // cast to string for later comparison

        // Get nickname.
        var n;
        if (user_links[i].children.length) {
            // This is an avatar link, not a text link.
            n = user_links[i].childNodes[0].alt;
        } else {
            // This is a text link. Easy.
            n = user_links[i].innerHTML;
        }

        // check the alleged abusers data store for a match.
        if (-1 !== abuser_ids.indexOf(id)) {
            FAADE.log('found match on this page for alleged abuser ID number ' + id);
            // highlight the user's links that matched an alleged abuser using CSS
            user_links[i].setAttribute('class', user_links[i].className + ' faade_alleged_abuser');

        }

        // Don't create another link if we just made one for that user.
        if (id === last_id) { continue; }

        // Offer a link to add another report for this user.
        // See also: https://support.google.com/docs/bin/answer.py?hl=en&answer=160000
        // Add link to report this user for a consent violation.
        var a = FAADE.createAbuseReportLink(id, n);
        user_links[i].parentNode.appendChild(a);
        last_id = id;
    }
};

FAADE.createAbuseReportLink = function (id, nick) {
    var a = document.createElement('a');
    a.setAttribute('class', 'faade_report_link');
    a.setAttribute('target', '_blank');
    var href = 'https://docs.google.com/spreadsheet/viewform?formkey=' + FAADE.getReportFormKey();
    href += '&entry_0=' + id;
    href += '&entry_1=' + nick;
    a.setAttribute('href', href);
    a.innerHTML = '(report a consent violation by ' + nick + ')';
    return a;
};

// The following is required for Chrome compatibility, as we need "text/html" parsing.
/*
 * DOMParser HTML extension
 * 2012-09-04
 *
 * By Eli Grey, http://eligrey.com
 * Public domain.
 * NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
 */

/*! @source https://gist.github.com/1129031 */
/*global document, DOMParser*/

(function(DOMParser) {
	"use strict";

	var
	  DOMParser_proto = DOMParser.prototype
	, real_parseFromString = DOMParser_proto.parseFromString
	;

	// Firefox/Opera/IE throw errors on unsupported types
	try {
		// WebKit returns null on unsupported types
		if ((new DOMParser).parseFromString("", "text/html")) {
			// text/html parsing is natively supported
			return;
		}
	} catch (ex) {}

	DOMParser_proto.parseFromString = function(markup, type) {
		if (/^\s*text\/html\s*(?:;|$)/i.test(type)) {
			var
			  doc = document.implementation.createHTMLDocument("")
			;

			doc.body.innerHTML = markup;
			return doc;
		} else {
			return real_parseFromString.apply(this, arguments);
		}
	};
}(DOMParser));
