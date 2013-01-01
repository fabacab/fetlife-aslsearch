/**
 *
 * This is a Greasemonkey script and must be run using a Greasemonkey-compatible browser.
 *
 * @author maymay <bitetheappleback@gmail.com>
 */
// ==UserScript==
// @name           FetLife ASL Search
// @version        0.3.7
// @namespace      http://maybemaimed.com/playground/fetlife-aslsearch/
// @updateURL      https://userscripts.org/scripts/source/146293.user.js
// @description    Allows you to search for FetLife profiles based on age, sex, location, and role.
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
// @exclude        https://fetlife.com/adgear/*
// @exclude        https://fetlife.com/chat/*
// @exclude        https://fetlife.com/im_sessions*
// @exclude        https://fetlife.com/polling/*
// @grant          GM_xmlhttpRequest
// @grant          GM_addStyle
// @grant          GM_log
// ==/UserScript==

FL_ASL = {};
FL_ASL.CONFIG = {
    'debug': false, // switch to true to debug.
    'progress_id': 'fetlife_asl_search_progress',
    'min_matches': 1 // show at least this many matches before offering to search again
};

FL_ASL.total_result_count = 0; // How many matches have we found, across all pages, on this load?

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
    // Set minimum matches, if that's been asked for.
    if (document.getElementById('fl_asl_min_matches').value) {
        FL_ASL.CONFIG.min_matches = document.getElementById('fl_asl_min_matches').value;
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
            if (0 === result_count || FL_ASL.CONFIG.min_matches > FL_ASL.total_result_count) {
                FL_ASL.getKinkstersFromURL(next_url);
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
    html_string += '<fieldset><legend>Result set options:</legend><p>';
    html_string += '<label>Return at least <input id="fl_asl_min_matches" name="fl_asl_min_matches" value="" placeholder="1" size="2" /> matches per search.</label> (Set this lower if no results seem to ever appear.)';
    html_string += '</p></fieldset>';
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
