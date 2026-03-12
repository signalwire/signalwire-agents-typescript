import { HttpClient } from '../../src/rest/HttpClient.js';
import { PhoneNumbersResource } from '../../src/rest/namespaces/phone-numbers.js';
import { AddressesResource } from '../../src/rest/namespaces/addresses.js';
import { QueuesResource } from '../../src/rest/namespaces/queues.js';
import { RecordingsResource } from '../../src/rest/namespaces/recordings.js';
import { NumberGroupsResource } from '../../src/rest/namespaces/number-groups.js';
import { VerifiedCallersResource } from '../../src/rest/namespaces/verified-callers.js';
import { SipProfileResource } from '../../src/rest/namespaces/sip-profile.js';
import { LookupResource } from '../../src/rest/namespaces/lookup.js';
import { ShortCodesResource } from '../../src/rest/namespaces/short-codes.js';
import { ImportedNumbersResource } from '../../src/rest/namespaces/imported-numbers.js';
import { mockClientOptions } from './helpers.js';

function makeHttp(responses: any[] = [{ status: 200, body: { data: [] } }]) {
  const { options, getRequests } = mockClientOptions(responses);
  return { http: new HttpClient(options), getRequests };
}

describe('PhoneNumbersResource', () => {
  it('lists phone numbers', async () => {
    const { http, getRequests } = makeHttp();
    const res = new PhoneNumbersResource(http);
    await res.list();
    expect(getRequests()[0].url).toContain('/api/relay/rest/phone_numbers');
  });

  it('searches available numbers', async () => {
    const { http, getRequests } = makeHttp();
    const res = new PhoneNumbersResource(http);
    await res.search({ areaCode: '512' });
    expect(getRequests()[0].url).toContain('/api/relay/rest/phone_numbers/search');
    expect(getRequests()[0].url).toContain('areaCode=512');
  });

  it('updates with PUT', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: {} }]);
    const res = new PhoneNumbersResource(http);
    await res.update('pn1', { name: 'main' });
    expect(getRequests()[0].method).toBe('PUT');
  });

  it('creates (purchases) a number', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: { id: 'pn1' } }]);
    const res = new PhoneNumbersResource(http);
    await res.create({ number: '+15551234567' });
    expect(getRequests()[0].method).toBe('POST');
  });

  it('deletes (releases) a number', async () => {
    const { http, getRequests } = makeHttp([{ status: 204 }]);
    const res = new PhoneNumbersResource(http);
    await res.delete('pn1');
    expect(getRequests()[0].method).toBe('DELETE');
  });
});

describe('AddressesResource', () => {
  it('lists addresses', async () => {
    const { http, getRequests } = makeHttp();
    const res = new AddressesResource(http);
    await res.list();
    expect(getRequests()[0].url).toContain('/api/relay/rest/addresses');
  });

  it('creates an address', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: { id: 'a1' } }]);
    const res = new AddressesResource(http);
    await res.create({ street: '123 Main' });
    expect(getRequests()[0].method).toBe('POST');
  });

  it('gets an address', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: { id: 'a1' } }]);
    const res = new AddressesResource(http);
    await res.get('a1');
    expect(getRequests()[0].url).toContain('/api/relay/rest/addresses/a1');
  });

  it('deletes an address', async () => {
    const { http, getRequests } = makeHttp([{ status: 204 }]);
    const res = new AddressesResource(http);
    await res.delete('a1');
    expect(getRequests()[0].method).toBe('DELETE');
  });
});

describe('QueuesResource', () => {
  it('lists queues', async () => {
    const { http, getRequests } = makeHttp();
    const res = new QueuesResource(http);
    await res.list();
    expect(getRequests()[0].url).toContain('/api/relay/rest/queues');
  });

  it('updates with PUT', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: {} }]);
    const res = new QueuesResource(http);
    await res.update('q1', { name: 'support' });
    expect(getRequests()[0].method).toBe('PUT');
  });

  it('lists members', async () => {
    const { http, getRequests } = makeHttp();
    const res = new QueuesResource(http);
    await res.listMembers('q1');
    expect(getRequests()[0].url).toContain('/api/relay/rest/queues/q1/members');
  });

  it('gets next member', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: { id: 'm1' } }]);
    const res = new QueuesResource(http);
    await res.getNextMember('q1');
    expect(getRequests()[0].url).toContain('/api/relay/rest/queues/q1/members/next');
  });

  it('gets a specific member', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: { id: 'm1' } }]);
    const res = new QueuesResource(http);
    await res.getMember('q1', 'm1');
    expect(getRequests()[0].url).toContain('/api/relay/rest/queues/q1/members/m1');
  });
});

describe('RecordingsResource', () => {
  it('lists recordings', async () => {
    const { http, getRequests } = makeHttp();
    const res = new RecordingsResource(http);
    await res.list();
    expect(getRequests()[0].url).toContain('/api/relay/rest/recordings');
  });

  it('gets a recording', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: { id: 'r1' } }]);
    const res = new RecordingsResource(http);
    await res.get('r1');
    expect(getRequests()[0].url).toContain('/api/relay/rest/recordings/r1');
  });

  it('deletes a recording', async () => {
    const { http, getRequests } = makeHttp([{ status: 204 }]);
    const res = new RecordingsResource(http);
    await res.delete('r1');
    expect(getRequests()[0].method).toBe('DELETE');
  });
});

describe('NumberGroupsResource', () => {
  it('lists number groups', async () => {
    const { http, getRequests } = makeHttp();
    const res = new NumberGroupsResource(http);
    await res.list();
    expect(getRequests()[0].url).toContain('/api/relay/rest/number_groups');
  });

  it('updates with PUT', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: {} }]);
    const res = new NumberGroupsResource(http);
    await res.update('ng1', { name: 'group1' });
    expect(getRequests()[0].method).toBe('PUT');
  });

  it('lists memberships', async () => {
    const { http, getRequests } = makeHttp();
    const res = new NumberGroupsResource(http);
    await res.listMemberships('ng1');
    expect(getRequests()[0].url).toContain('/api/relay/rest/number_groups/ng1/number_group_memberships');
  });

  it('adds a membership', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: { id: 'ngm1' } }]);
    const res = new NumberGroupsResource(http);
    await res.addMembership('ng1', { phone_number_id: 'pn1' });
    expect(getRequests()[0].method).toBe('POST');
    expect(getRequests()[0].url).toContain('/number_group_memberships');
  });

  it('gets a membership by ID', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: { id: 'ngm1' } }]);
    const res = new NumberGroupsResource(http);
    await res.getMembership('ngm1');
    expect(getRequests()[0].url).toContain('/api/relay/rest/number_group_memberships/ngm1');
  });

  it('deletes a membership', async () => {
    const { http, getRequests } = makeHttp([{ status: 204 }]);
    const res = new NumberGroupsResource(http);
    await res.deleteMembership('ngm1');
    expect(getRequests()[0].url).toContain('/api/relay/rest/number_group_memberships/ngm1');
    expect(getRequests()[0].method).toBe('DELETE');
  });
});

describe('VerifiedCallersResource', () => {
  it('lists verified callers', async () => {
    const { http, getRequests } = makeHttp();
    const res = new VerifiedCallersResource(http);
    await res.list();
    expect(getRequests()[0].url).toContain('/api/relay/rest/verified_caller_ids');
  });

  it('updates with PUT', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: {} }]);
    const res = new VerifiedCallersResource(http);
    await res.update('vc1', { name: 'main' });
    expect(getRequests()[0].method).toBe('PUT');
  });

  it('redials verification', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: {} }]);
    const res = new VerifiedCallersResource(http);
    await res.redialVerification('vc1');
    expect(getRequests()[0].url).toContain('/verified_caller_ids/vc1/verification');
    expect(getRequests()[0].method).toBe('POST');
  });

  it('submits verification code', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: {} }]);
    const res = new VerifiedCallersResource(http);
    await res.submitVerification('vc1', { code: '1234' });
    expect(getRequests()[0].url).toContain('/verified_caller_ids/vc1/verification');
    expect(getRequests()[0].method).toBe('PUT');
  });
});

describe('SipProfileResource', () => {
  it('gets SIP profile', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: { name: 'default' } }]);
    const res = new SipProfileResource(http);
    await res.get();
    expect(getRequests()[0].url).toContain('/api/relay/rest/sip_profile');
    expect(getRequests()[0].method).toBe('GET');
  });

  it('updates SIP profile with PUT', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: {} }]);
    const res = new SipProfileResource(http);
    await res.update({ codecs: ['PCMU'] });
    expect(getRequests()[0].url).toContain('/api/relay/rest/sip_profile');
    expect(getRequests()[0].method).toBe('PUT');
  });
});

describe('LookupResource', () => {
  it('looks up a phone number', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: { carrier: 'T-Mobile' } }]);
    const res = new LookupResource(http);
    await res.phoneNumber('+15551234567');
    expect(getRequests()[0].url).toContain('/api/relay/rest/lookup/phone_number/+15551234567');
  });

  it('passes include params', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: {} }]);
    const res = new LookupResource(http);
    await res.phoneNumber('+15551234567', { include: 'cnam' });
    expect(getRequests()[0].url).toContain('include=cnam');
  });
});

describe('ShortCodesResource', () => {
  it('lists short codes', async () => {
    const { http, getRequests } = makeHttp();
    const res = new ShortCodesResource(http);
    await res.list();
    expect(getRequests()[0].url).toContain('/api/relay/rest/short_codes');
  });

  it('gets a short code', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: { id: 'sc1' } }]);
    const res = new ShortCodesResource(http);
    await res.get('sc1');
    expect(getRequests()[0].url).toContain('/api/relay/rest/short_codes/sc1');
  });

  it('updates with PUT', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: {} }]);
    const res = new ShortCodesResource(http);
    await res.update('sc1', { name: 'promo' });
    expect(getRequests()[0].method).toBe('PUT');
  });
});

describe('ImportedNumbersResource', () => {
  it('creates (imports) a number', async () => {
    const { http, getRequests } = makeHttp([{ status: 200, body: { id: 'in1' } }]);
    const res = new ImportedNumbersResource(http);
    await res.create({ number: '+15551234567' });
    expect(getRequests()[0].url).toContain('/api/relay/rest/imported_phone_numbers');
    expect(getRequests()[0].method).toBe('POST');
  });
});
