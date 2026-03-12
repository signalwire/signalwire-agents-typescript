/**
 * REST Example: 10DLC brand and campaign compliance registration.
 *
 * WARNING: This example interacts with the real 10DLC registration system.
 * Brand and campaign registrations may have side effects and costs.
 * Use with caution in production environments.
 *
 * Prerequisites:
 *   export SIGNALWIRE_PROJECT_ID=your-project-id
 *   export SIGNALWIRE_API_TOKEN=your-api-token
 *   export SIGNALWIRE_SPACE=your-space.signalwire.com
 *
 * Run:
 *   npx tsx rest/examples/rest-10dlc-registration.ts
 */

import { SignalWireClient, RestError } from '../../src/index.js';

const client = new SignalWireClient();

async function main() {
  // 1. Register a brand
  console.log('Registering 10DLC brand...');
  let brandId: string | null = null;
  try {
    const brand = await client.registry.brands.create({
      company_name: 'Acme Corp',
      ein: '12-3456789',
      entity_type: 'PRIVATE_PROFIT',
      vertical: 'TECHNOLOGY',
      website: 'https://acme.example.com',
      country: 'US',
    });
    brandId = brand.id;
    console.log(`  Registered brand: ${brandId}`);
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Brand registration failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // 2. List brands
  console.log('\nListing brands...');
  const brands = await client.registry.brands.list();
  for (const b of brands.data ?? []) {
    console.log(`  - ${b.id}: ${b.name ?? 'unnamed'}`);
  }
  if (!brandId && brands.data?.length) {
    brandId = brands.data[0].id;
  }

  // 3. Get brand details
  if (brandId) {
    const detail = await client.registry.brands.get(brandId);
    console.log(`\nBrand detail: ${detail.name ?? 'N/A'} (${detail.state ?? 'N/A'})`);
  }

  // 4. Create a campaign under the brand
  let campaignId: string | null = null;
  if (brandId) {
    console.log('\nCreating campaign...');
    try {
      const campaign = await client.registry.brands.createCampaign(brandId, {
        use_case: 'MIXED',
        description: 'Customer notifications and support messages',
        sample_message: 'Your order #12345 has shipped.',
      });
      campaignId = campaign.id;
      console.log(`  Created campaign: ${campaignId}`);
    } catch (err) {
      if (err instanceof RestError) {
        console.log(`  Campaign creation failed (expected in demo): ${err.statusCode}`);
      } else throw err;
    }
  }

  // 5. List campaigns for the brand
  if (brandId) {
    console.log('\nListing brand campaigns...');
    const campaigns = await client.registry.brands.listCampaigns(brandId);
    for (const c of campaigns.data ?? []) {
      console.log(`  - ${c.id}: ${c.name ?? 'unknown'}`);
      if (!campaignId) campaignId = c.id;
    }
  }

  // 6. Get and update campaign
  if (campaignId) {
    const campDetail = await client.registry.campaigns.get(campaignId);
    console.log(`\nCampaign: ${campDetail.name ?? 'N/A'} (${campDetail.state ?? 'N/A'})`);

    try {
      await client.registry.campaigns.update(campaignId, {
        description: 'Updated: customer notifications',
      });
      console.log('  Campaign description updated');
    } catch (err) {
      if (err instanceof RestError) {
        console.log(`  Campaign update failed: ${err.statusCode}`);
      } else throw err;
    }
  }

  // 7. Create an order to assign numbers
  let orderId: string | null = null;
  if (campaignId) {
    console.log('\nCreating number assignment order...');
    try {
      const order = await client.registry.campaigns.createOrder(campaignId, {
        phone_numbers: ['+15125551234'],
      });
      orderId = order.id;
      console.log(`  Created order: ${orderId}`);
    } catch (err) {
      if (err instanceof RestError) {
        console.log(`  Order creation failed (expected in demo): ${err.statusCode}`);
      } else throw err;
    }
  }

  // 8. Get order status
  if (orderId) {
    const orderDetail = await client.registry.orders.get(orderId);
    console.log(`  Order status: ${orderDetail.status ?? 'N/A'}`);
  }

  // 9. List campaign numbers and orders
  if (campaignId) {
    console.log('\nListing campaign numbers...');
    const numbers = await client.registry.campaigns.listNumbers(campaignId);
    for (const n of numbers.data ?? []) {
      console.log(`  - ${n.phone_number ?? n.id ?? 'unknown'}`);
    }

    const orders = await client.registry.campaigns.listOrders(campaignId);
    for (const o of orders.data ?? []) {
      console.log(`  - Order ${o.id}: ${o.status ?? 'unknown'}`);
    }
  }

  // 10. Unassign a number (clean up)
  if (campaignId) {
    console.log('\nUnassigning numbers...');
    const nums = await client.registry.campaigns.listNumbers(campaignId);
    for (const n of nums.data ?? []) {
      try {
        await client.registry.numbers.delete(n.id);
        console.log(`  Unassigned number ${n.id}`);
      } catch (err) {
        if (err instanceof RestError) {
          console.log(`  Unassign failed: ${err.statusCode}`);
        } else throw err;
      }
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
