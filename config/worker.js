const CronJob = require('cron').CronJob;
const downloader = require('./downloader');
const Task = require('../models/task');
const async = require('async');
const _ = require('lodash');
var AWS = require('aws-sdk');
var fs = require('fs');
AWS.config.region = 'ap-northeast-2';
const s3 = new AWS.S3({logger: console});
const rimraf = require('rimraf');

const job = () => {
    console.log('==== worker start ====');
    async.waterfall([
        (nextStep) => {
            Task.findAll({
                where: {
                    status: {
                        $or: [Task.CONST.STATUS.STATUS_WAIT, 
                                Task.CONST.STATUS.STATUS_PROCESSING]
                    }
                },
                order: [['createdAt', 'ASC']]
            }).then((tasks) => {
                nextStep(null, tasks);
            }).catch(nextStep);
        },
        (tasks, nextStep) => {
            let task = _.filter(tasks, (task) => task.status == Task.CONST.STATUS.STATUS_WAIT);
            task = task.length ? task[0] : null;
            if (task && 
                !_.filter(tasks, (task) => task.status == Task.CONST.STATUS.STATUS_PROCESSING).length) {
                console.log('exist task : ' + task);
                task.status = Task.CONST.STATUS.STATUS_PROCESSING;
                task.save().then((task) => {
                    nextStep(null, task);
                }).catch(nextStep);
            } else {
                nextStep('not exist any waiting tasks');
            }
        },
        (task, nextStep) => {
            downloader(task.webtoonId, task.startIdx, task.endIdx)
                .then((fileName) => {
                    nextStep(null, {fileName, task});
                }, (err) => {
                    nextStep(null, {err, task});
                });
        },
        (result, nextStep) => {
            if (!result.err) {
                var param = {
                    'Bucket':'adultistorage',
                    'Key': result.fileName,
                    'ACL':'public-read',
                    'Body':fs.createReadStream(result.fileName)
                };
                s3.upload(param, function(err, data){
                    if (err) {
                        result.task.link = result.fileName;
                        result.task.status = Task.CONST.STATUS.STATUS_ERROR;
                        result.task.error = JSON.stringify(err);
                        result.task.save().then(() => {
                            nextStep(null, result.fileName);
                        }).catch(nextStep);
                    }
                    else {
                        result.task.link = result.fileName;
                        result.task.status = Task.CONST.STATUS.STATUS_DONE;
                        result.task.save().then(() => {
                            nextStep(null, result.fileName);
                        }).catch(nextStep);   
                    }
                });
            } else {
                console.log('!!!!!!!!!!!!!!!!!!!!fucking error');
                console.log(result.err);
                result.task.error = JSON.stringify(result.err);
                result.task.status = Task.CONST.STATUS.STATUS_ERROR;
                result.task.save().then(() => {
                    nextStep();
                }).catch(nextStep);
            }
        },
        (fileName, nextStep) => {
            rimraf(fileName, () => {
                nextStep();
            });
        }
    ], (err, result) => {
        if (err) {
            console.log('err : ');
            console.log(err);
        } else {
            console.log('==== worker end ====');
        }
    });
};

new CronJob('00 * * * * *', () => {
    job();
}, null, true, 'Asia/Seoul');