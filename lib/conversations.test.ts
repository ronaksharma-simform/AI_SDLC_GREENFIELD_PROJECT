import { describe, it, expect } from 'vitest';
import {
  MESSAGE_CONTENT_MAX,
  sanitizeMessageContent,
  isParticipant,
  conversationWhereParticipant
} from '@/lib/conversations';

describe('sanitizeMessageContent', () => {
  it('trims surrounding whitespace', () => {
    expect(sanitizeMessageContent('  hello  ')).toBe('hello');
  });

  it('strips HTML tags to prevent script injection (Part A §7 — Security)', () => {
    expect(sanitizeMessageContent('hi <script>alert(1)</script>')).toBe('hi alert(1)');
    expect(sanitizeMessageContent('<img src=x onerror=alert(1)>')).toBe('');
  });

  it('normalises CRLF to single newlines', () => {
    expect(sanitizeMessageContent('line1\r\nline2\rline3')).toBe('line1\nline2\nline3');
  });

  it('crops content to MESSAGE_CONTENT_MAX characters', () => {
    const long = 'a'.repeat(MESSAGE_CONTENT_MAX + 100);
    expect(sanitizeMessageContent(long)).toHaveLength(MESSAGE_CONTENT_MAX);
  });
});

describe('isParticipant', () => {
  const conversation = { providerId: 'p', seekerId: 's' };

  it('returns true for the provider and seeker', () => {
    expect(isParticipant(conversation, 'p')).toBe(true);
    expect(isParticipant(conversation, 's')).toBe(true);
  });

  it('returns false for anyone else', () => {
    expect(isParticipant(conversation, 'x')).toBe(false);
  });
});

describe('conversationWhereParticipant', () => {
  it('selects conversations where the user is provider or seeker', () => {
    expect(conversationWhereParticipant('u')).toEqual({
      OR: [{ providerId: 'u' }, { seekerId: 'u' }]
    });
  });
});
