import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUserFindUnique, mockNotificationCreate } = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockNotificationCreate: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    notification: { create: mockNotificationCreate }
  }
}));

import {
  buildNotificationTitle,
  buildNotificationMessage,
  notifyUser
} from '@/lib/notifications';

describe('buildNotificationTitle', () => {
  it('returns a fixed headline for each notification type', () => {
    expect(buildNotificationTitle('RideRequestReceived')).toBe('New ride request');
    expect(buildNotificationTitle('RideRequestAccepted')).toBe('Request accepted');
    expect(buildNotificationTitle('TripReminder')).toBe('Trip reminder');
    expect(buildNotificationTitle('NewMessage')).toBe('New message');
  });
});

describe('buildNotificationMessage', () => {
  it('builds the Request Received message with the seeker name', () => {
    expect(
      buildNotificationMessage('RideRequestReceived', { seekerName: 'Priya' })
    ).toBe('New ride request from Priya');
  });

  it('falls back gracefully when the seeker name is absent', () => {
    expect(buildNotificationMessage('RideRequestReceived', {})).toBe('New ride request from a rider');
  });

  it('builds the Request Accepted message', () => {
    expect(buildNotificationMessage('RideRequestAccepted', {})).toBe('Your request was accepted');
  });

  it('builds the Trip Reminder message with the destination', () => {
    expect(
      buildNotificationMessage('TripReminder', { destinationAddress: 'Office' })
    ).toBe('Your ride to Office departs in 15 minutes');
  });

  it('builds the New Message message with the sender name', () => {
    expect(buildNotificationMessage('NewMessage', { senderName: 'Amit' })).toBe(
      'New message from Amit'
    );
  });
});

describe('notifyUser', () => {
  beforeEach(() => {
    mockUserFindUnique.mockReset();
    mockNotificationCreate.mockReset();
  });

  it('skips creation when the recipient cannot be resolved (Section 12)', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const result = await notifyUser('missing-user', 'RideRequestAccepted', {
      rideId: 'ride-1',
      requestId: 'req-1'
    });

    expect(result).toBeNull();
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it('creates a notification with title, message and related ids', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'user-1' });
    const created = {
      id: 'notif-1',
      userId: 'user-1',
      type: 'RideRequestAccepted',
      title: 'Request accepted',
      message: 'Your request was accepted',
      relatedRideId: 'ride-1',
      relatedRequestId: 'req-1',
      isRead: false,
      createdAt: new Date('2026-08-21T00:00:00.000Z')
    };
    mockNotificationCreate.mockResolvedValue(created);

    const result = await notifyUser('user-1', 'RideRequestAccepted', {
      rideId: 'ride-1',
      requestId: 'req-1'
    });

    expect(result).toEqual(created);
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true }
    });
    expect(mockNotificationCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'RideRequestAccepted',
        title: 'Request accepted',
        message: 'Your request was accepted',
        relatedRideId: 'ride-1',
        relatedRequestId: 'req-1'
      }
    });
  });

  it('stores null related ids when none are supplied', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'user-1' });
    mockNotificationCreate.mockResolvedValue({ id: 'n', userId: 'user-1' });

    await notifyUser('user-1', 'TripReminder');

    expect(mockNotificationCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'TripReminder',
        title: 'Trip reminder',
        message: 'Your ride to your destination departs in 15 minutes',
        relatedRideId: null,
        relatedRequestId: null
      }
    });
  });
});
