const controller = require('../controllers/tasks.controller');

module.exports = (router) => {
    router.get('/tasks', controller.getTasks);
    router.post('/tasks', controller.newTask);
        
    return router;
};