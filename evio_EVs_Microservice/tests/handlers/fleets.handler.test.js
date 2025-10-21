const constants = require('../../utils/constants');
const { totalFilters } = require('../../controllers/fleetsHandler');

describe('totalFilters', () => {
  beforeAll(() => {
    constants.listTypesAssets = ['TYPECARD', 'TYPEUSER'];
  });

  it('should group fleets by fleet name and assets by brand', async () => {
    const fleets = [
      { name: 'Fleet A', listEvs: [{}, {}] },
      { name: 'Fleet B', listEvs: [{}, {}] },
      { name: 'Fleet C', listEvs: [{}, {}, {}] }
    ];
    const mockRecords = [
      { fleet: { name: 'Fleet A' }, brand: 'Tesla' },
      { fleet: { name: 'Fleet A' }, brand: 'Tesla' },
      { fleet: { name: 'Fleet B' }, brand: 'Nissan' },
      { fleet: { name: 'Fleet B' }, brand: 'TYPECARD' },
      { fleet: { name: 'Fleet C' }, brand: 'Unknown' },
      { fleet: { name: 'Fleet C' }, brand: 'BMW' },
      { fleet: { name: 'Fleet C' }, brand: 'TYPEUSER' },
      { fleet: {}, brand: 'Audi' }, // no fleet name, should be skipped
    ];

    const [fleetFilter, assetFilter] = await totalFilters({ records: mockRecords }, fleets);

    expect(fleetFilter.title).toBe('fleets');
    expect(fleetFilter.values).toEqual([
      { value: 'Fleet A', total: 2 },
      { value: 'Fleet B', total: 2 },
      { value: 'Fleet C', total: 3 },
    ]);

    expect(assetFilter.title).toBe('assets');
    expect(assetFilter.values).toEqual(
      expect.arrayContaining([
        { value: 'EV', total: 6 },
        { value: 'TYPECARD', total: 1 },
        { value: 'TYPEUSER', total: 1 },
      ])
    );
  });

  it('should handle empty records and fleets', async () => {
    const [fleetFilter, assetFilter] = await totalFilters({ records: [] }, []);
    expect(fleetFilter.values).toEqual([]);
    expect(assetFilter.values).toEqual([]);
  });

  it('should skip items without fleet name', async () => {
    const fleets = [];
    const mockRecords = [
      { fleet: {}, brand: 'Tesla' },
      { brand: 'BMW' },
    ];
    const [fleetFilter, assetFilter] = await totalFilters({ records: mockRecords }, fleets);
    expect(fleetFilter.values).toEqual([]);
    expect(assetFilter.values).toEqual([
      { value: 'EV', total: 2 }
    ]);
  });
});