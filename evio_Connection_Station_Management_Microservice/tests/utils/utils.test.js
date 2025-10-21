const { calculateTimeValue, getFoundStations,getPublicData, getType, queryCreation} = require('../../utils/utils');
const { StationsEnum } = require('../../utils/enums/enumStations');
const Constants = require('../../utils/constants');

describe('calculateTimeValue', () => {
    test('should return timeCharger when it is the minimum value', () => {
        const plug = { power: 50 };
        const chargingCapacity = 40;
        const totalBatteryCapacity = 200;
        const timeCharger = 1;
        const result = calculateTimeValue(plug, chargingCapacity, totalBatteryCapacity, timeCharger);
        expect(result).toBe(timeCharger/60);
    });

    test('should return calculated time based on chargingCapacity when plug power is greater or equal to chargingCapacity', () => {
        const plug = { power: 50 };
        const chargingCapacity = 40;
        const totalBatteryCapacity = 200;
        const timeCharger = 10;
        const expected = Math.min(timeCharger, (totalBatteryCapacity / chargingCapacity)*60)/60;
        const result = calculateTimeValue(plug, chargingCapacity, totalBatteryCapacity, timeCharger);
        expect(result).toBeCloseTo(expected);
    });

    test('should return calculated time based on plug power when plug power is less than chargingCapacity', () => {
        const plug = { power: 30 };
        const chargingCapacity = 40;
        const totalBatteryCapacity = 200;
        const timeCharger = 10;
        const expected = Math.min(timeCharger, (totalBatteryCapacity / plug.power)*60)/60;
        const result = calculateTimeValue(plug, chargingCapacity, totalBatteryCapacity, timeCharger);
        expect(result).toBeCloseTo(expected);
    });
});


describe('getFoundStations', () => {
    it('should return an empty array when filter is undefined', () => {
        expect(getFoundStations()).toEqual([]);
    });

    it('should return an empty array when filter.stations is not an array', () => {
        const filter = { stations: 'not an array' };
        expect(getFoundStations(filter)).toEqual([]);
    });

    it('should return an array of found stations', () => {
      const filter = { stations: [ StationsEnum.public, StationsEnum.private] };
      expect(getFoundStations(filter)).toEqual([ StationsEnum.public, StationsEnum.private] );
    });

    it('should ignore stations not in StationsEnum', () => {
      const filter = { stations: [ StationsEnum.public, 'STATION4'] };
      expect(getFoundStations(filter)).toEqual([ StationsEnum.public]);
    });
});

describe('getType', () => {
    it('should return evio when only private station is found', () => {
      const foundStations = [StationsEnum.private];
      expect(getType(foundStations)).toBe(StationsEnum.evio);
    });
  
    it('should return StationsPublic when public stations are found', () => {
      const foundStations = [StationsEnum.public];
      expect(getType(foundStations)).toBe(process.env.StationsPublic);
    });
  
    it('should return evio when evio station is found', () => {
      const foundStations = [StationsEnum.evio];
      expect(getType(foundStations)).toBe(StationsEnum.evio);
    });
  
    it('should return tesla when tesla station is found', () => {
      const foundStations = [StationsEnum.tesla];
      expect(getType(foundStations)).toBe(StationsEnum.tesla);
    });
  
    it('should return empty string when no known station is found', () => {
      const foundStations = ['unknown'];
      expect(getType(foundStations)).toBe('');
    });
  });


  describe('queryCreation', () => {
    const initialFilter = {
      availableStations: [],
      connectorType: [],
      parkingType: [],
      vehicles: []
    }

    it('should return geometry.coordinates non [0,0] filter', () => {
      expect(queryCreation(initialFilter, true)).toEqual({
        plugs: {
          $elemMatch: {},
        },
        'geometry.coordinates': { $ne: [0, 0] }
      });
    });

    it('should not return geometry.coordinates non [0,0] filter', () => {
      expect(queryCreation(initialFilter, false)).toEqual({
        plugs: {
          $elemMatch: {},
        }
      });
    });
  });