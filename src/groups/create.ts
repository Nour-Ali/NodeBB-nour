import meta from '../meta';
import plugins from '../plugins';
import slugify from '../slugify';
import db from '../database';

interface DataObject {
    name : string;
    system : boolean | string;
    timestamp : number;
    disableJoinRequests: number; // or boolean?
    disableLeave: number;
    hidden: number;
    private: number;
    userTitle: number;
    userTitleEnabled: number;
    description: string;
    ownerUid: number;
}

interface GroupObject {
    systemGroups : string[];
    isPrivilegeGroup(x : string) : boolean; // eslinted
    create(data: DataObject) : Promise<GroupData>; // implemented
    validateGroupName(name :string) : Error | void; // implemented
    getGroupData(name: string) : Promise <GroupData>; // eslinted
}

interface GroupData {
    name: string,
    slug: string,
    createtime: number,
    userTitle: string | number,
    userTitleEnabled: number,
    description: string,
    memberCount: number,
    hidden: number,
    system: number,
    private: number,
    disableJoinRequests: number,
    disableLeave: number,
}


export default function (Groups : GroupObject) {
    function isSystemGroup(data: DataObject) : boolean {
        // return data.system === true || parseInt(data.system, 10) === 1 ||
        //     Groups.systemGroups.includes(data.name) ||
        //     Groups.isPrivilegeGroup(data.name);

        if (typeof (data.system) === 'boolean' && data.system === true) {
            return true;
        } else if (typeof (data.system) === 'string' && parseInt(data.system, 10) === 1) {
            return true;
        } else if (typeof (data.system) === 'string') {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const x : boolean = Groups.systemGroups.includes(data.name);

            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const y : boolean = Groups.isPrivilegeGroup(data.name);

            return x || y;
        }

        return false;
    }

    Groups.validateGroupName = function (name: string): Error | void {
        if (!name) {
            throw new Error('[[error:group-name-too-short]]');
        }

        if (typeof name !== 'string') {
            throw new Error('[[error:invalid-group-name]]');
        }

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (!Groups.isPrivilegeGroup(name) && name.length > meta.config.maximumGroupNameLength) { // eslint
            throw new Error('[[error:group-name-too-long]]');
        }

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (name === 'guests' || (!Groups.isPrivilegeGroup(name) && name.includes(':'))) {
            throw new Error('[[error:invalid-group-name]]');
        }

        if (name.includes('/') || !slugify(name)) {
            throw new Error('[[error:invalid-group-name]]');
        }
    };

    Groups.create = async function (data: DataObject) : Promise<GroupData> {
        const isSystem : boolean = isSystemGroup(data); // implemented below
        const timestamp : number = data.timestamp || Date.now();
        let disableJoinRequests: number = data.disableJoinRequests === 1 ? 1 : 0;
        if (data.name === 'administrators') {
            disableJoinRequests = 1;
        }
        const disableLeave: 1 | 0 = data.disableLeave === 1 ? 1 : 0;
        const isHidden: boolean = data.hidden === 1;

        Groups.validateGroupName(data.name); // implemented below

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const exists: boolean = await meta.userOrGroupExists(data.name) as boolean;
        if (exists) {
            throw new Error('[[error:group-already-exists]]');
        }

        const memberCount: 1 | 0 = data.hasOwnProperty('ownerUid') ? 1 : 0;
        const isPrivate: boolean = data.hasOwnProperty('private') && data.private !== undefined ? data.private === 1 : true;
        const groupData : GroupData = {
            name: data.name,
            slug: slugify(data.name) as string, // eslint??
            createtime: timestamp,
            userTitle: data.userTitle || data.name,
            userTitleEnabled: data.userTitleEnabled === 1 ? 1 : 0,
            description: data.description || '',
            memberCount: memberCount,
            hidden: isHidden ? 1 : 0,
            system: isSystem ? 1 : 0,
            private: isPrivate ? 1 : 0,
            disableJoinRequests: disableJoinRequests,
            disableLeave: disableLeave,
        };

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
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

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const newgroupData: GroupData = await Groups.getGroupData(groupData.name);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await plugins.hooks.fire('action:group.create', { group: newgroupData });
        return newgroupData;
    };
}
