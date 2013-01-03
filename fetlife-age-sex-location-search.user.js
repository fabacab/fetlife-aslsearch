/**
 *
 * This is a Greasemonkey script and must be run using a Greasemonkey-compatible browser.
 *
 * @author maymay <bitetheappleback@gmail.com>
 */
// ==UserScript==
// @name           FetLife ASL Search
// @version        0.3.6
// @namespace      http://maybemaimed.com/playground/fetlife-aslsearch/
// @updateURL      https://userscripts.org/scripts/source/146293.user.js
// @description    Allows you to search for FetLife profiles based on age, sex, location, and role.
// @include        https://fetlife.com/*
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

FL_ASL = {};
FL_ASL.CONFIG = {
    'debug': false, // switch to true to debug.
    'progress_id': 'fetlife_asl_search_progress'
};

// Utility debugging function.
FL_ASL.log = function (msg) {
    if (!FL_ASL.CONFIG.debug) { return; }
    GM_log('FETLIFE ASL SEARCH: ' + msg);
};

// Initializations.
var uw = (unsafeWindow) ? unsafeWindow : window ; // Help with Chrome compatibility?
GM_addStyle('\
#fetlife_asl_search_options { display: none; }\
#fetlife_asl_search_options fieldset { clear: both; margin: 0; padding: 0; }\
#fetlife_asl_search_options legend { display: none; }\
#fetlife_asl_search_options label {\
    display: inline-block;\
    white-space: nowrap;\
}\
#fetlife_asl_search_options input { width: auto; }\
#fetlife_asl_search_results { clear: both; }\
');
FL_ASL.users = {};
FL_ASL.init = function () {
    FL_ASL.CONFIG.search_form = document.querySelector('form[action="/search"]').parentNode;
    FL_ASL.getUserProfile(uw.FetLife.currentUser.id);
    FL_ASL.main();
};
window.addEventListener('DOMContentLoaded', FL_ASL.init);

FL_ASL.toggleAslSearch = function () {
    var el = document.getElementById('fetlife_asl_search_options');
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
            user_loc = FL_ASL.getLocationForUser(uw.FetLife.currentUser.id);
            for (var xk in user_loc) {
                if (null !== user_loc[xk] && (-1 !== search_in.indexOf(xk)) ) {
                    r.loc[xk] = user_loc[xk];
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

FL_ASL.getLocationForUser = function (id) {
    var r = {
        'city_id': null,
        'area_id': null,
        'country': null
    };
    var profile_html = FL_ASL.users[id].profile_html;
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

FL_ASL.getUserProfile = function (id) {
    if (FL_ASL.users[id]) {
        return FL_ASL.users[id].profile_html;
    } else {
        FL_ASL.users[id] = {};
        GM_xmlhttpRequest({
            'method': 'GET',
            'url': 'https://fetlife.com/users/' + id.toString(),
            'onload': function (response) {
                FL_ASL.users[id].profile_html = response.responseText;
            }
        });
    }
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
    FL_ASL.log('Getting Kinksters list from URL: ' + url);
    prog = document.getElementById(FL_ASL.CONFIG.progress_id);
    prog.innerHTML = prog.innerHTML + '.';
    GM_xmlhttpRequest({
        'method': 'GET',
        'url': url,
        'onload': function (response) {
            var parser = new DOMParser();
            var doc = parser.parseFromString(response.responseText, 'text/html');
            var els = doc.querySelectorAll('.user_in_list');

            result_count = 0;
            for (var i = 0; i < els.length; i++) {
                // filter the results based on the form parameters
                if (FL_ASL.matchesSearchParams(els[i])) {
                    // display the results in a "results" section in this portion of the page
                    FL_ASL.displayResult(els[i]);
                    result_count++;
                }
            }

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

            // Automatically search on next page if no results found.
            if (0 === result_count) {
                FL_ASL.getKinkstersFromURL(next_url);
                return false;
            } else {
                // Reset UI search feedback.
                p = prog.parentNode
                p.removeChild(prog);
                new_prog = document.createElement('p');
                new_prog.setAttribute('id', FL_ASL.CONFIG.progress_id);
                p.appendChild(new_prog);
            }
            btn = document.createElement('button');
            btn.setAttribute('id', 'btn_moar');
            btn.setAttribute('onclick', "var xme = document.getElementById('btn_moar'); xme.parentNode.removeChild(xme); return false;");
            btn.innerHTML = 'Show me MOAR&hellip;';
            btn.addEventListener('click', function(){FL_ASL.getKinkstersFromURL(next_url)});
            document.getElementById('fetlife_asl_search_results').appendChild(btn);
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

// This is the main() function, executed on page load.
FL_ASL.main = function () {
    // Insert ASL search button interface at FetLife "Search" bar.
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
    var div = document.createElement('div');
    div.setAttribute('id', 'fetlife_asl_search_options');
    div.setAttribute('style', 'display: none;');
    html_string = '<fieldset><legend>Search for user profiles of the following gender/sex:</legend><p>';
    html_string += 'Show me profiles of people with a gender/sex of&hellip;';
    // NOTE: What if the UI only allowed us to find male-ish identified people, not women? What would the response be? :)
    html_string += '<label><input type="checkbox" name="user[sex]" value="M" checked="checked" /> Male</label>';
//    html_string += '<label><input type="checkbox" name="user[sex]" value="F" /> Female</label>';
//    html_string += '<label><input type="checkbox" name="user[sex]" value="CD/TV" />Crossdresser/Transvestite</label>';
    html_string += '<label><input type="checkbox" name="user[sex]" value="MtF" />Trans - Male to Female</label>';
    html_string += '<label><input type="checkbox" name="user[sex]" value="FtM" checked="checked" />Trans - Female to Male</label>';
    html_string += '<label><input type="checkbox" name="user[sex]" value="TG" />Transgender</label>';
    html_string += '<label><input type="checkbox" name="user[sex]" value="GF" />Gender Fluid</label>';
    html_string += '<label><input type="checkbox" name="user[sex]" value="GQ" />Genderqueer</label>';
    html_string += '<label><input type="checkbox" name="user[sex]" value="IS" />Intersex</label>';
    html_string += '<label><input type="checkbox" name="user[sex]" value="B" />Butch</label>';
//    html_string += '<label><input type="checkbox" name="user[sex]" value="FEM" />Femme</label>';
    html_string += '</p></fieldset>';
    html_string += '<fieldset><legend>Search for user profiles between the ages of:</legend><p>';
    html_string += '&hellip;who are also <label>at least <input type="text" name="min_age" id="min_age" size="2" /> years old</label> and <label>at most <input type="text" name="max_age" id="max_age" size="2" /> years old&hellip;</label>';
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
    // Note that "Not Applicable" is the equivalent of "it doesn't matter", so we omit this.
    //html_string += '<label><input type="checkbox" name="user[role]" value="" />Not Applicable</label>';
    html_string += '</p></fieldset>';
    html_string += '<fieldset><legend>Search for user profiles located in:</legend><p>';
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
    html_string += ' my <label><input type="radio" name="fl_asl_loc" value="city_id" />city</label>';
    html_string += '<label><input type="radio" name="fl_asl_loc" value="area_id" checked="checked" />state/province</label>';
    html_string += '<label><input type="radio" name="fl_asl_loc" value="country" />country</label>';
    html_string += '.</p></fieldset>';
    div.innerHTML = html_string;
    FL_ASL.CONFIG.search_form.appendChild(label);
    FL_ASL.CONFIG.search_form.appendChild(div);
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
    FL_ASL.getUserProfile(uw.FetLife.currentUser.id); // run early
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
    // Inject hidden dialog box link.
    var trigger_el = document.createElement('a');
    trigger_el.setAttribute('class', 'opens-modal');
    trigger_el.setAttribute('data-opens-modal', 'faade');
    document.body.appendChild(trigger_el);

    // Inject dialog box HTML. FetLife currently uses Rails 3, so mimic that.
    // See, for instance, Rails Behaviors: http://josh.github.com/rails-behaviors/
    var faade_dialog = document.createElement('div');
    faade_dialog.setAttribute('style', 'display: none; position: absolute; overflow: hidden; z-index: 1000; outline: 0px none;');
    faade_dialog.setAttribute('class', 'ui-dialog ui-widget ui-widget-content ui-corner-all');
    faade_dialog.setAttribute('tabindex', '-1');
    faade_dialog.setAttribute('role', 'dialog');
    faade_dialog.setAttribute('aria-labelledby', 'ui-dialog-title-faade');
    var html_string = '<div class="ui-dialog-titlebar ui-widget-header ui-corner-all ui-helper-clearfix" unselectable="on" style="-moz-user-select: none;">';
    html_string += '<span class="ui-dialog-title" id="ui-dialog-title-faade" unselectable="on" style="-moz-user-select: none;">FetLife Alleged Abusers Database Engine (FAADE)</span>';
    html_string += '<a href="#" class="ui-dialog-titlebar-close ui-corner-all" role="button" unselectable="on" style="-moz-user-select: none;">';
    html_string += '<span class="ui-icon ui-icon-closethick" unselectable="on" style="-moz-user-select: none;">close</span>';
    html_string += '</a>';
    html_string += '</div>';
    html_string += '<div data-modal-title="FetLife Alleged Abusers Database Engine (FAADE)" data-modal-height="280" data-modal-auto-open="false" class="modal ui-dialog-content ui-widget-content" id="faade">';
    html_string += '<p class="mbm">There have been <span id="faade_reports_to_alert">X</span> new consent violations filed in FAADE that may have been perpetrated near your location (<span id="faade_user_loc">X, X, X</span>).</p>';
    html_string += '<p>Click "View new nearby FAADE reports" to view the profiles of the people who have been accused of consent violations near your area in new tabs.</p>';
    html_string += '<p id="faade-actions" class="ac">';
    html_string += '<a rel="nofollow" class="btnsqr close" data-closes-modal="faade" href="#">View new nearby FAADE reports</a>';
    html_string += '<span class="i s q">&nbsp;-or-&nbsp;</span>';
    html_string += '<a data-closes-modal="faade" class="close tdn q" href="#">Cancel</a>';
    html_string += '</p>';
    html_string += '<p>(Don\'t worry, I\'m not looking for where you actually are. Your location was determined from your FetLife profile.)</p>';
    html_string += '</div>';
    faade_dialog.innerHTML = html_string;
    document.body.appendChild(faade_dialog);

    // Attach event listener to trigger element.
    document.querySelector('[data-opens-modal="faade"]').addEventListener('click', function (e) {
        document.querySelector('[data-opens-modal="faade"]').dialog("open");
    });
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

        var user_loc = FAADE.getLocationFromProfileHtml(FL_ASL.users[uw.FetLife.currentUser.id].profile_html);
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
        if (FL_ASL.users[uw.FetLife.currentUser.id].profile_html) {
            FAADE.log('We have the current user\'s FetLife profile HTML. Running broadcast checks.');
            FAADE.broadcastNewProximalReports(doc);
        }
    }, 5000); // give us a few seconds to grab the current user's FetLife profile HTML.

    // Are we on a user profile page?
    if (window.location.href.match(/users\/(\d+)\/?$/)) {

        var profile_nick = document.querySelector('h2.bottom').childNodes[0].textContent.match(/\S+/)[0];
        var id_in_url = window.location.href.match(/users\/(\d+)\/?$/)[1];

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
                    + '" title="Permalink for FAADE abuse report number ' + num.toString() + ' against '
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
