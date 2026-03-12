/**
 * REST Example: Full phone number inventory lifecycle.
 *
 * Prerequisites:
 *   export SIGNALWIRE_PROJECT_ID=your-project-id
 *   export SIGNALWIRE_API_TOKEN=your-api-token
 *   export SIGNALWIRE_SPACE=your-space.signalwire.com
 *
 * Run:
 *   npx tsx rest/examples/rest-phone-number-management.ts
 */

import { SignalWireClient, RestError } from '../../src/index.js';

const client = new SignalWireClient();

async function main() {
  // 1. Search for available phone numbers
  console.log('Searching available numbers...');
  const available = await client.phoneNumbers.search({ area_code: '512', max_results: 3 });
  for (const num of available.data ?? []) {
    console.log(`  - ${num.e164 ?? num.number ?? 'unknown'}`);
  }

  // 2. Purchase a number
  console.log('\nPurchasing a phone number...');
  let numId: string | null = null;
  try {
    const first = (available.data ?? [{}])[0];
    const number = await client.phoneNumbers.create({ number: first.e164 ?? '+15125551234' });
    numId = number.id;
    console.log(`  Purchased: ${numId}`);
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Purchase failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // 3. List and get owned numbers
  console.log('\nListing owned numbers...');
  const owned = await client.phoneNumbers.list();
  for (const n of (owned.data ?? []).slice(0, 5)) {
    console.log(`  - ${n.number ?? 'unknown'} (${n.id})`);
  }

  if (numId) {
    const detail = await client.phoneNumbers.get(numId);
    console.log(`  Detail: ${detail.number ?? 'N/A'}`);
  }

  // 4. Update a number
  if (numId) {
    console.log(`\nUpdating number ${numId}...`);
    await client.phoneNumbers.update(numId, { name: 'Main Line' });
    console.log("  Updated name to 'Main Line'");
  }

  // 5. Create a number group
  console.log('\nCreating number group...');
  let groupId: string | null = null;
  try {
    const group = await client.numberGroups.create({ name: 'Sales Pool' });
    groupId = group.id;
    console.log(`  Created group: ${groupId}`);
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Group creation failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // 6. Add a membership and list memberships
  if (groupId && numId) {
    console.log('\nAdding number to group...');
    try {
      const membership = await client.numberGroups.addMembership(groupId, { phone_number_id: numId });
      const memId = membership.id;
      console.log(`  Membership: ${memId}`);

      const memberships = await client.numberGroups.listMemberships(groupId);
      for (const m of memberships.data ?? []) {
        console.log(`  - Member: ${m.id ?? 'unknown'}`);
      }
    } catch (err) {
      if (err instanceof RestError) {
        console.log(`  Membership failed (expected in demo): ${err.statusCode}`);
      } else throw err;
    }
  }

  // 7. Lookup carrier info
  console.log('\nLooking up carrier info...');
  try {
    const info = await client.lookup.phoneNumber('+15125551234');
    console.log(`  Carrier: ${info.carrier?.name ?? 'unknown'}`);
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Lookup failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // 8. Create a verified caller
  console.log('\nCreating verified caller...');
  let callerId: string | null = null;
  try {
    const caller = await client.verifiedCallers.create({ phone_number: '+15125559999' });
    callerId = caller.id;
    console.log(`  Created verified caller: ${callerId}`);
    await client.verifiedCallers.submitVerification(callerId, { verification_code: '123456' });
    console.log('  Verification code submitted');
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Verified caller failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // 9. Get and update SIP profile
  console.log('\nGetting SIP profile...');
  try {
    const profile = await client.sipProfile.get();
    console.log(`  SIP profile: ${JSON.stringify(profile)}`);
    await client.sipProfile.update({ default_codecs: ['PCMU', 'PCMA'] });
    console.log('  Updated SIP codecs');
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  SIP profile failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // 10. List short codes
  console.log('\nListing short codes...');
  try {
    const codes = await client.shortCodes.list();
    for (const sc of codes.data ?? []) {
      console.log(`  - ${sc.short_code ?? 'unknown'}`);
    }
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Short codes failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // 11. Create an address
  console.log('\nCreating address...');
  let addrId: string | null = null;
  try {
    const addr = await client.addresses.create({
      friendly_name: 'HQ Address',
      street: '123 Main St',
      city: 'Austin',
      region: 'TX',
      postal_code: '78701',
      iso_country: 'US',
    });
    addrId = addr.id;
    console.log(`  Created address: ${addrId}`);
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Address creation failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // 12. Clean up
  console.log('\nCleaning up...');
  if (addrId) {
    await client.addresses.delete(addrId);
    console.log(`  Deleted address ${addrId}`);
  }
  if (callerId) {
    try {
      await client.verifiedCallers.delete(callerId);
      console.log(`  Deleted verified caller ${callerId}`);
    } catch (err) {
      if (err instanceof RestError) {
        console.log(`  Verified caller delete failed: ${err.statusCode}`);
      } else throw err;
    }
  }
  if (groupId) {
    await client.numberGroups.delete(groupId);
    console.log(`  Deleted number group ${groupId}`);
  }
  if (numId) {
    try {
      await client.phoneNumbers.delete(numId);
      console.log(`  Released number ${numId}`);
    } catch (err) {
      if (err instanceof RestError) {
        console.log(`  Release number failed (recently purchased): ${err.statusCode}`);
      } else throw err;
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
