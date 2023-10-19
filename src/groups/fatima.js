"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// importing modules;
const meta_1 = __importDefault(require("../meta"));
const plugins_1 = __importDefault(require("../plugins"));
const slugify_1 = __importDefault(require("../slugify"));
const database_1 = __importDefault(require("../database"));
function default_1(Groups) {
    function isSystemGroup(data) {
        if (typeof (data.system) === 'boolean' && data.system === true) {
            return true;
        }
        else if (typeof (data.system) === 'string' && parseInt(data.system, 10) === 1) {
            return true;
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const x = Groups.systemGroups.includes(data.name);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const y = Groups.isPrivilegeGroup(data.name);
        return x || y;
    }
    Groups.create = async function (data) {
        const isSystem = isSystemGroup(data); // checks if the group is a system group from output of isSystemGroup
        const timestamp = data.timestamp || Date.now(); // gets the timestamp of the group
        // const timestamp = data.timestamp || Date.now(); // gets the timestamp of the group
        let disableJoinRequests = parseInt(data.disableJoinRequests, 10) === 1 ? 1 : 0;
        if (data.name === 'administrators') {
            disableJoinRequests = 1;
        } // dont let a person join if the name of the group is admin
        const disableLeave = parseInt(data.disableLeave, 10) === 1 ? 1 : 0;
        const isHidden = parseInt(data.hidden, 10) === 1;
        Groups.validateGroupName(data.name);
        const exists = await meta_1.default.userOrGroupExists(data.name);
        if (exists) {
            throw new Error('[[error:group-already-exists]]');
        }
        const memberCount = data.hasOwnProperty('ownerUid') ? 1 : 0;
        const isPrivate = data.hasOwnProperty('private') && data.private !== undefined ? data.private === 1 : true;
        const groupData = {
            name: data.name,
            slug: (0, slugify_1.default)(data.name),
            createtime: timestamp,
            userTitle: data.userTitle || data.name,
            userTitleEnabled: parseInt(data.userTitleEnabled, 10) === 1 ? 1 : 0,
            description: data.description || '',
            memberCount: memberCount,
            hidden: isHidden ? 1 : 0,
            system: isSystem ? 1 : 0,
            private: isPrivate ? 1 : 0,
            disableJoinRequests: disableJoinRequests,
            disableLeave: disableLeave,
        };
        await plugins_1.default.hooks.fire('filter:group.create', { group: groupData, data: data });
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await database_1.default.sortedSetAdd('groups:createtime', groupData.createtime, groupData.name);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await database_1.default.setObject(`group:${groupData.name}`, groupData);
        if (data.hasOwnProperty('ownerUid')) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await database_1.default.setAdd(`group:${groupData.name}:owners`, data.ownerUid);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await database_1.default.sortedSetAdd(`group:${groupData.name}:members`, timestamp, data.ownerUid);
        }
        if (!isHidden && !isSystem) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await database_1.default.sortedSetAddBulk([
                ['groups:visible:createtime', timestamp, groupData.name],
                ['groups:visible:memberCount', groupData.memberCount, groupData.name],
                ['groups:visible:name', 0, `${groupData.name.toLowerCase()}:${groupData.name}`],
            ]);
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await database_1.default.setObjectField('groupslug:groupname', groupData.slug, groupData.name);
        const groupData2 = await Groups.getGroupData(groupData.name);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await plugins_1.default.hooks.fire('action:group.create', { group: groupData2 });
        return groupData2;
    };
    Groups.validateGroupName = function (name) {
        if (!name) {
            throw new Error('[[error:group-name-too-short]]');
        }
        if (typeof name !== 'string') {
            throw new Error('[[error:invalid-group-name]]');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (!Groups.isPrivilegeGroup(name) && name.length > meta_1.default.config.maximumGroupNameLength) {
            throw new Error('[[error:group-name-too-long]]');
        }
        if (name === 'guests' || (!Groups.isPrivilegeGroup(name) && name.includes(':'))) {
            throw new Error('[[error:invalid-group-name]]');
        }
        if (name.includes('/') || !(0, slugify_1.default)(name)) {
            throw new Error('[[error:invalid-group-name]]');
        }
    };
}
exports.default = default_1;
