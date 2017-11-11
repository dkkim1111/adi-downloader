const request = require('request');
const _ = require('lodash');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const $ = require('jquery');
const async = require('async');

const ADULTI_URL = ''; // remove for copyright
const LIST_URL = ADULTI_URL + '/board/webtoon/listdetail/wr_id';

module.exports.getTitle = (webtoonId) => {
	return new Promise((resolve, reject) => {
		let webtoonTitle = '';
		request(LIST_URL + '/' + webtoonId, (err, response, body) => {
			if (err) reject(err);
			else {
				const dom = new JSDOM(body);
				const $ = require('jquery')(dom.window);
				let links = _.map($('#list .list-group-item'), (d) => $(d).attr('href'));
				webtoonTitle = $('label.control-label').eq(0).text().trim();
				resolve(webtoonTitle);
			}
		});
	});
}