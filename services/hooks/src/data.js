const Entity = require('azure-entities');
const debug = require('debug')('hooks:data');
const assert = require('assert');
const Promise = require('promise');
const taskcluster = require('taskcluster-client');
const _ = require('lodash');

/** Entity for tracking hooks and associated state **/
const Hook = Entity.configure({
  version: 1,
  partitionKey: Entity.keys.StringKey('hookGroupId'),
  rowKey: Entity.keys.StringKey('hookId'),
  signEntities: true,
  properties: {
    hookGroupId: Entity.types.String,
    hookId: Entity.types.String,
    metadata: Entity.types.JSON,
    // task template
    task: Entity.types.JSON,
    // pulse bindings (TODO; empty for now)
    bindings: Entity.types.JSON,
    // timings for the task (in fromNow format, e.g., "1 day")
    deadline: Entity.types.String,
    expires: Entity.types.String,
    // schedule for this task (see schemas/schedule.yml)
    schedule: Entity.types.JSON,
    // access token used to trigger this task via webhook
    triggerToken: Entity.types.EncryptedText,
    // the taskId that will be used next time this hook is scheduled;
    // this allows scheduling to be idempotent
    nextTaskId: Entity.types.EncryptedText,
    // next date at which this task is scheduled to run
    nextScheduledDate: Entity.types.Date,

  },
}).configure({
  version: 2,
  signEntities: true,
  properties: {
    hookGroupId: Entity.types.String,
    hookId: Entity.types.String,
    metadata: Entity.types.JSON,
    // task template
    task: Entity.types.JSON,
    // pulse bindings (TODO; empty for now)
    bindings: Entity.types.JSON,
    // timings for the task (in fromNow format, e.g., "1 day")
    deadline: Entity.types.String,
    expires: Entity.types.String,
    // schedule for this task (see schemas/schedule.yml)
    schedule: Entity.types.JSON,
    // access token used to trigger this task via webhook
    triggerToken: Entity.types.EncryptedText,
    // the taskId that will be used next time this hook is scheduled;
    // this allows scheduling to be idempotent
    nextTaskId: Entity.types.EncryptedText,
    // next date at which this task is scheduled to run
    nextScheduledDate: Entity.types.Date,

  },
  migrate: function(item) {
    // remove the task timestamps, as they are overwritten when the hook fires
    // (bug 1225234)
    delete item.task.created;
    delete item.task.expires;
    delete item.task.deadline;
    return item;
  },
}).configure({
  version: 3,
  signEntities: true,
  properties: {
    hookGroupId: Entity.types.String,
    hookId: Entity.types.String,
    metadata: Entity.types.JSON,
    // task template
    task: Entity.types.JSON,
    // pulse bindings (TODO; empty for now)
    bindings: Entity.types.JSON,
    // timings for the task (in fromNow format, e.g., "1 day")
    deadline: Entity.types.String,
    expires: Entity.types.String,
    // schedule for this task (see schemas/schedule.yml)
    schedule: Entity.types.JSON,
    // access token used to trigger this task via webhook
    triggerToken: Entity.types.EncryptedText,
    // information about the last time this hook fired:
    // {error: ".."} or {taskId: ".."}
    lastFire: Entity.types.JSON,
    // the taskId that will be used next time this hook is scheduled;
    // this allows scheduling to be idempotent
    nextTaskId: Entity.types.EncryptedText,
    // next date at which this task is scheduled to run
    nextScheduledDate: Entity.types.Date,
  },
  migrate: function(item) {
    item.lastFire = {result: 'no-fire'};
    return item;
  },
}).configure({
  version: 4,
  signEntities: true,
  properties: {
    hookGroupId: Entity.types.String,
    hookId: Entity.types.String,
    metadata: Entity.types.JSON,
    // task template
    task: Entity.types.JSON,
    // pulse bindings (TODO; empty for now)
    bindings: Entity.types.JSON,
    // timings for the task (in fromNow format, e.g., "1 day")
    deadline: Entity.types.String,
    expires: Entity.types.String,
    // schedule for this task (see schemas/schedule.yml)
    schedule: Entity.types.JSON,
    // access token used to trigger this task via webhook
    triggerToken: Entity.types.EncryptedText,
    // information about the last time this hook fired:
    // {error: ".."} or {taskId: ".."}
    lastFire: Entity.types.JSON,
    // the taskId that will be used next time this hook is scheduled;
    // this allows scheduling to be idempotent
    nextTaskId: Entity.types.EncryptedText,
    // next date at which this task is scheduled to run
    nextScheduledDate: Entity.types.Date,
    //triggerSchema define types allowed in a context
    triggerSchema: Entity.types.JSON,
  },
  migrate: function(item) {
    item.triggerSchema = {type: 'object', properties: {}, additionalProperties: false};
    return item;
  },
}).configure({
  version: 5,
  signEntities: true,
  properties: {
    hookGroupId: Entity.types.String,
    hookId: Entity.types.String,
    metadata: Entity.types.JSON,
    // task template
    task: Entity.types.JSON,
    // pulse bindings (TODO; empty for now)
    bindings: Entity.types.JSON,
    // schedule for this task (see schemas/schedule.yml)
    schedule: Entity.types.JSON,
    // access token used to trigger this task via webhook
    triggerToken: Entity.types.EncryptedText,
    // information about the last time this hook fired:
    // {error: ".."} or {taskId: ".."}
    lastFire: Entity.types.JSON,
    // the taskId that will be used next time this hook is scheduled;
    // this allows scheduling to be idempotent
    nextTaskId: Entity.types.EncryptedText,
    // next date at which this task is scheduled to run
    nextScheduledDate: Entity.types.Date,
    //triggerSchema define types allowed in a context
    triggerSchema: Entity.types.JSON,
  },
  migrate: function(item) {
    delete item.task.expires;
    delete item.task.deadline;
    return item;
  },
});

/** Return promise for hook definition */
Hook.prototype.definition = function() {
  return Promise.resolve({
    hookId: this.hookId,
    hookGroupId: this.hookGroupId,
    bindings: this.bindings,
    metadata: _.cloneDeep(this.metadata),
    task: _.cloneDeep(this.task),
    schedule: _.cloneDeep(this.schedule),
    triggerSchema: this.triggerSchema,
  });
};

const Queues = Entity.configure({
  version: 1,
  partitionKey: Entity.keys.StringKey('hookGroupId'),
  rowKey: Entity.keys.StringKey('hookId'),
  signEntities: true,
  properties: {
    hookGroupId: Entity.types.String,
    hookId: Entity.types.String,
    queueName: Entity.types.String,
    bindings: Entity.types.JSON,
  },
});

// export Hook and Queues
exports.Hook = Hook;
exports.Queues = Queues;

const LastFire = Entity.configure({
  version: 1,
  partitionKey: Entity.keys.StringKey('hookGroupId', 'hookId'),
  rowKey: Entity.keys.StringKey('taskId'),
  signEntities: true,
  properties: {
    hookGroupId: Entity.types.String,
    hookId: Entity.types.String,
    firedBy: Entity.types.String,
    taskId: Entity.types.String,
    taskCreateTime: Entity.types.Date,
    result: Entity.types.String,
    error: Entity.types.String,
  },
});

LastFire.prototype.definition = function() {
  return Promise.resolve({
    hookGroupId: this.hookGroupId,
    hookId: this.hookId,
    firedBy: this.firedBy,
    taskId: this.taskId,
    taskCreateTime: this.taskCreateTime,
    result: this.result,
    error: this.error,
  });
};

LastFire.expires = async function(Hook, now, n = 100) {
  const hookIds = new Set();
  let count = 0;
  await Hook.scan({},
    {
      handler: async hook => {
        const { hookId } = await hook.definition();
        hookIds.add(hookId);
      },
    },
  );

  for (hookId of hookIds) {
    const hookData = [];
    await this.scan({
      taskCreateTime: Entity.op.lessThan(now),
      hookId: Entity.op.equal(hookId)}, {
      limit: 500,
      handler: async item => {
        const { hookGroupId, taskId, taskCreateTime } = await item.definition();
        hookData.push({hookGroupId, taskId, taskCreateTime});
      },
    },
    );
    hookData.sort((a, b) =>
      new Date(b.taskCreateTime) - new Date(a.taskCreateTime));

    for(let i=n;i<hookData.length;i++) {
      await this.remove({
        hookGroupId: hookData[i].hookGroupId,
        hookId,
        taskId: hookData[i].taskId});
      count++;
    }
  }
  return count;
};
// export LastFire
exports.LastFire = LastFire;
