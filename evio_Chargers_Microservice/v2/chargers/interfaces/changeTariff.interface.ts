export interface ITariff {
    groupName?: string;
    groupId?: string;
    fleetName?: string;
    fleetId?: string;
    tariffId: string;
    tariff: any;
    tariffType: string;
    name: string;
}

interface IPlug {
    statusChangeDate: Date;
    tariff: ITariff[];
}

interface IGroup {
    groupName: string;
    groupId: string;
}

interface IFleet {
    fleetName: string;
    fleetId: string;
}

export interface ICharger {
    plugs: IPlug[];
    accessType: string;
    listOfGroups: IGroup[];
    listOfFleets: IFleet[];
    [key: string]: any;
}
