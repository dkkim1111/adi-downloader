const request = require('request');
const _ = require('lodash');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const $ = require('jquery');
const async = require('async');
const download = require('image-downloader');
const fs = require('fs');
const mkdirp = require('mkdirp');
const gm = require('gm');
const archiver = require('archiver');
const rimraf = require('rimraf');

const ADULTI_URL = 'https://adulti01.com';
const LIST_URL = ADULTI_URL + '/board/webtoon/listdetail/wr_id';
const DETAIL_URL = ADULTI_URL + '/board/webtoon/view/wr_id';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36 OPR/48.0.2685.39';

function downloadWebtoon(webtoonId, startIdx, endIdx) {
	return new Promise((resolve, reject) => {
		let webtoonTitle = '';
		async.waterfall([
			(nextStep) => {
				request(LIST_URL + '/' + webtoonId, (err, response, body) => {
					if (err) nextStep(err);
					else {
						const dom = new JSDOM(body);
						const $ = require('jquery')(dom.window);
						let links = _.map($('#list .list-group-item'), (d) => $(d).attr('href'));
						webtoonTitle = $('label.control-label').eq(0).text().trim();
						nextStep(null, links.slice(startIdx, (endIdx + 1)));
					}
				});
			},
			(links, nextStep) => {
				let tasks = _.map(links, (link, page) => {
					return (nextStep) => {
						request(ADULTI_URL + link, {
							headers: {
								'User-Agent': USER_AGENT
							}
						}, (err, response, body) => {
							if (err) nextStep(err);
							else {
								const dom = new JSDOM(body);
								const $ = require('jquery')(dom.window);
								let imgUrls = _.map($('.about-image img'), (d) => $(d).attr('src'));
								let tasks = _.map(imgUrls, (url, idx) => {
									let dest = './' + webtoonId + '/' + (page + startIdx);
									return (nextStep) => {
										async.waterfall([
											(nextStep) => {
												fs.exists(dest, (exists) => {
													if (exists) {
														nextStep(null);
													} else {
														mkdirp(dest, (err) => {
															if (err) nextStep(err);
															else nextStep(null);
														});
													}
												});
											},
											(nextStep) => {
												download.image({
													url: url,
													dest: dest + '/' + idx + '.jpg'
												}).then(({ filename, image }) => {
													console.log('saved : ' + filename);
													nextStep(null, filename);
												}).catch(() => {
													nextStep(null, undefined);
												});
											}
										], (err, results) => {
											if (err) nextStep(err);
											else nextStep(null, results);
										});
										// TODO: img download
										//console.log(url);
										//nextStep(null);
									};
								});

								async.parallel(tasks, (err, results) => {
									if (err) nextStep(err);
									else nextStep(null, _.compact(results));
								});
							}
						});
					};
				});
				async.parallel(tasks, (err, results) => {
					if (err) nextStep(err);
					else nextStep(null, _.compact(results));
				});
			}
		], (err, results) => {
			if (err) reject('err ' + err.toString());
			else resolve({webtoonTitle, results});
		});
	});
}

function mergeImage(images, dest) {
	console.log(dest);
	return new Promise((resolve, reject) => {
		var gmstate = gm(images[0]);
		for (var i = 1; i < images.length; i++) gmstate.append(images[i]);

		gmstate.write(dest, (err) => {
			if (!err) resolve(dest);
			else {
				console.log(err);
				reject(err.toString() + ' / ' + dest);
			}
		});
	});
}

function zipImages(images, dest) {
	return new Promise((resolve, reject) => {
		let output = fs.createWriteStream(dest);
		let archive = archiver('zip');
		
		output.on('close', () => {
		    console.log(archive.pointer() + ' total bytes');
		    console.log('archiver has been finalized and the output file descriptor has closed.');
			resolve();
		});
		
		archive.on('error', reject)
		output.on('end', function() {
			console.log('Data has been drained');
		});
		archive.pipe(output);
		_.each(images, (image) => archive.file(image));
		archive.finalize();
	});
}

module.exports = (webtoonId, startIdx, endIdx) => {
	return new Promise((resolve, reject) => {
		let webtoonTitle = '';
		async.waterfall([
			(nextStep) => {
				downloadWebtoon(webtoonId, startIdx, endIdx)
					.then((result) => nextStep(null, result), nextStep);
			},
			(result, nextStep) => {
				webtoonTitle = result.webtoonTitle;
				let imageGroups = result.results;
				imageGroups = _.filter(imageGroups, (imageGroup) => imageGroup.length > 0);
				let tasks = _.map(imageGroups, (images) => {
					let baseImage = images[0];
					let strs = baseImage.split('/');
					return (nextStep) => {
						mergeImage(images, './' + strs[1] + '/' + strs[2] + '.png')
							.then((dest) => nextStep(null, dest), nextStep);
					};
				});
				
				async.series(tasks, (err, results) => {
					if (err) nextStep(err);
					else nextStep(null, results);
				});
			},
			(images, nextStep) => {
				let zipFileName = webtoonTitle + '_' + startIdx + '화_' + endIdx + '화.zip';
				zipImages(images, './' + zipFileName).then(() => {
					nextStep(null, zipFileName);
				}).then(nextStep);
			},
			(zipFileName, nextStep) => {
				rimraf('./' + webtoonId, () => {
					nextStep(null, zipFileName);
				});
			}
		], (err, result) => {
			if (err) reject(err);
			else resolve(result);
		});
	});
}