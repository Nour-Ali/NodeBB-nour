// importing modules;
import meta from '../meta';
import plugins from '../plugins';
import slugify from '../slugify';
import db from '../database';

interface DataObject {
    name : string;
    timestamp : number;
    disableJoinRequests : string;
    disableLeave : string;
    hidden : string;
    private : number;
    userTitle: number;
    userTitleEscaped: number;
    userTitleEnabled: string;
    description: string;
    ownerUid : number;
    system : string | boolean;
}

interface GroupData {
    name?: string;
    slug?: string;
    createtime?: number;
    userTitle?: string | number;
    userTitleEnabled?: number;
    description?: string;
    memberCount?: number;
    hidden?: number;
    system?: number;
    private?: number;
    disableJoinRequests?: number;
    disableLeave?: number;
}

interface GroupObject {
    systemGroups : string[];
    isPrivilegeGroup(x : string) : boolean;
    create(data : DataObject) : Promise <GroupData>;
    validateGroupName(name : string) : Error | void;
    getGroupData(groupName : string) : Promise <GroupData>;
}

export default function (Groups : GroupObject) {
    function isSystemGroup(data : DataObject) : boolean {
        if (typeof (data.system) === 'boolean' && data.system === true) {
            return true;
        } else if (typeof (data.system) === 'string' && parseInt(data.system, 10) === 1) {
            return true;
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const x : boolean = Groups.systemGroups.includes(data.name);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const y : boolean = Groups.isPrivilegeGroup(data.name);
        return x || y;
    }
    Groups.create = async function (data: DataObject): Promise<GroupData> {
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

        const exists : boolean = await meta.userOrGroupExists(data.name) as boolean;
        if (exists) {
            throw new Error('[[error:group-already-exists]]');
        }

        const memberCount = data.hasOwnProperty('ownerUid') ? 1 : 0;
        const isPrivate = data.hasOwnProperty('private') && data.private !== undefined ? data.private === 1 : true;
        const groupData: GroupData = {
            name: data.name,
            slug: slugify(data.name) as string,
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

        await plugins.hooks.fire('filter:group.create', { group: groupData, data: data });

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetAdd('groups:createtime', groupData.createtime, groupData.name);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObject(`group:${groupData.name}`, groupData);

        if (data.hasOwnProperty('ownerUid')) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.setAdd(`group:${groupData.name}:owners`, data.ownerUid);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.sortedSetAdd(`group:${groupData.name}:members`, timestamp, data.ownerUid);
        }

        if (!isHidden && !isSystem) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.sortedSetAddBulk([
                ['groups:visible:createtime', timestamp, groupData.name],
                ['groups:visible:memberCount', groupData.memberCount, groupData.name],
                ['groups:visible:name', 0, `${groupData.name.toLowerCase()}:${groupData.name}`],
            ]);
        }

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObjectField('groupslug:groupname', groupData.slug, groupData.name);

        const groupData2: GroupData = await Groups.getGroupData(groupData.name);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await plugins.hooks.fire('action:group.create', { group: groupData2 });
        return groupData2;
    };

    Groups.validateGroupName = function (name:string) : Error | void {
        if (!name) {
            throw new Error('[[error:group-name-too-short]]');
        }

        if (typeof name !== 'string') {
            throw new Error('[[error:invalid-group-name]]');
        }

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (!Groups.isPrivilegeGroup(name) && name.length > meta.config.maximumGroupNameLength) {
            throw new Error('[[error:group-name-too-long]]');
        }

        if (name === 'guests' || (!Groups.isPrivilegeGroup(name) && name.includes(':'))) {
            throw new Error('[[error:invalid-group-name]]');
        }

        if (name.includes('/') || !slugify(name)) {
            throw new Error('[[error:invalid-group-name]]');
        }
    };
}
