const Task = require('../models/task');
const disk = require('diskusage');
const async = require('async');

module.exports.getTasks = (req, res, next) => {
    async.parallel([
        (nextStep) => {
            // get disk usage. Takes mount point as first parameter
            disk.check('/', function(err, info) {
                if (err) nextStep(err);
                else {
                    nextStep(null, info);
                }
            });
        },
        (nextStep) => {
            Task.findAll({
                order: [['id', 'DESC']]
            }).then((tasks) => {
                nextStep(null, tasks);
            }).catch(next);
        }
    ], (err, results) => {
        if (err) res.status(500).send({err: err});
        else res.send({disk: results[0], tasks: results[1]});
    });
};

module.exports.newTask = (req, res, next) => {
    let task = req.body.task;
    task.status = Task.CONST.STATUS.STATUS_WAIT;
    Task.create(task).then((task) => {
        res.send(task);
    }).catch(next);
};