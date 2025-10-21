const NotificationsSettings = require('../../models/notificationsSettings'); 
const removeOldNotification = require('../../controllers/notificationsSettings').removeOldNotification;
const addNewNotification = require('../../controllers/notificationsSettings').addNewNotification;
const notifyMeUserList = require('../../controllers/notificationsSettings').notifyMeUserList;
const getNotificationsSettings = require('../../controllers/notificationsSettings').getNotificationsSettings;
const axios = require("axios");
jest.mock('../../models/notificationsSettings');
jest.mock('axios');
describe('addNewNotification', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should add new notifications without duplicates', async () => {
    const mockNotificationsToAdd = [
      { translationKey: 'NEW_NOTIFICATION_1' },
      { translationKey: 'NEW_NOTIFICATION_2' },
    ];

    const mockExistingNotifications = [
      {
        _id: 'existing_id',
        notificationsPref: [
          {
            notifications: [{ translationKey: 'EXISTING_NOTIFICATION' }]
          }
        ]
      }
    ];

    NotificationsSettings.find.mockResolvedValue(mockExistingNotifications);
    NotificationsSettings.bulkWrite.mockResolvedValue({});

    await addNewNotification(mockNotificationsToAdd, 1, 0);

    expect(NotificationsSettings.find).toHaveBeenCalledWith({}, {}, { skip: 0, limit: 1 });
    expect(NotificationsSettings.bulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: 'existing_id' },
          update: { $set: { notificationsPref: expect.any(Array) } }
        }
      }
    ]);

    const updatedNotifications = mockExistingNotifications[0].notificationsPref[0].notifications;
    expect(updatedNotifications.length).toBe(3);
    expect(updatedNotifications.map(n => n.translationKey)).toEqual([
      'EXISTING_NOTIFICATION',
      'NEW_NOTIFICATION_1',
      'NEW_NOTIFICATION_2'
    ]);
  });

  it('should not add duplicate notifications', async () => {
    const mockNotificationsToAdd = [
      { translationKey: 'DUPLICATE_NOTIFICATION' },
      { translationKey: 'NEW_NOTIFICATION' },
    ];

    const mockExistingNotifications = [
      {
        _id: 'existing_id',
        notificationsPref: [
          {
            notifications: [{ translationKey: 'DUPLICATE_NOTIFICATION' }]
          }
        ]
      }
    ];

    NotificationsSettings.find.mockResolvedValue(mockExistingNotifications);
    NotificationsSettings.bulkWrite.mockResolvedValue({});

    await addNewNotification(mockNotificationsToAdd, 1, 0);

    expect(NotificationsSettings.find).toHaveBeenCalledWith({}, {}, { skip: 0, limit: 1 });
    expect(NotificationsSettings.bulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: 'existing_id' },
          update: { $set: { notificationsPref: expect.any(Array) } }
        }
      }
    ]);

    const updatedNotifications = mockExistingNotifications[0].notificationsPref[0].notifications;
    expect(updatedNotifications.length).toBe(2);
    expect(updatedNotifications.map(n => n.translationKey)).toEqual([
      'DUPLICATE_NOTIFICATION',
      'NEW_NOTIFICATION'
    ]);
  });

  it('should handle empty result correctly', async () => {
    NotificationsSettings.find.mockResolvedValue([]);
    await addNewNotification([], 1, 0);

    expect(NotificationsSettings.find).toHaveBeenCalledWith({}, {}, { skip: 0, limit: 1 });
    expect(NotificationsSettings.bulkWrite).not.toHaveBeenCalled();
  });

  it('should handle error correctly', async () => {
    const mockError = new Error('Test error');
    NotificationsSettings.find.mockRejectedValue(mockError);

    await expect(addNewNotification([], 1, 0)).rejects.toThrowError(mockError);
  });
});
describe('removeOldNotification function', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should remove old notifications correctly', async () => {
    const mockNotifications = [
      { _id: '1', notificationsPref: [{ notifications: [{ translationKey: 'OLD_TYPE' }] }] },
      { _id: '2', notificationsPref: [{ notifications: [{ translationKey: 'NEW_TYPE' }] }] },
    ];

    NotificationsSettings.find.mockResolvedValue(mockNotifications);

    const notificationsToRemove = [{ translationKey: 'OLD_TYPE' }];

    await removeOldNotification(notificationsToRemove, 1000, 0);

    expect(NotificationsSettings.find).toHaveBeenCalledWith({}, {}, { skip: 0, limit: 500 });
    expect(NotificationsSettings.bulkWrite).toHaveBeenCalled();

    const expectedBulkWriteCalls = NotificationsSettings.bulkWrite.mock.calls;

    const updateOperations = expectedBulkWriteCalls[0][0];
    
    expect(updateOperations).toEqual([
      {
        updateOne: {
          filter: { _id: '1' },
          update: { $set: { notificationsPref: [{ notifications: [] }] } }
        }
      }
    ]);
  });

  it('should handle empty result correctly', async () => {
    NotificationsSettings.find.mockResolvedValue([]);

    const notificationsToRemove = [{ notificationType: 'OLD_TYPE' }];

    await removeOldNotification(notificationsToRemove, 1000, 0);

    expect(NotificationsSettings.find).toHaveBeenCalledWith({}, {}, { skip: 0, limit: 500 });
    expect(NotificationsSettings.bulkWrite).not.toHaveBeenCalled();
  });

  it('should handle error correctly', async () => {
    const mockError = new Error('Test error');
    NotificationsSettings.find.mockRejectedValue(mockError);

    const notificationsToRemove = [{ notificationType: 'OLD_TYPE' }];

    await expect(removeOldNotification(notificationsToRemove, 1000, 0)).rejects.toThrowError(mockError);

    expect(NotificationsSettings.find).toHaveBeenCalledWith({}, {}, { skip: 0, limit: 500 });
    expect(NotificationsSettings.bulkWrite).not.toHaveBeenCalled();
  });
});
