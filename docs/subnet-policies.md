# Subnet policies

The Clients page includes a separate **Subnet policies** editor for native Pi-hole v6 CIDR client entries. It works independently of DHCP, MAC discovery and external inventory. No database migration, router integration or collector is required.

For example, create a group called `IoT`, associate its lists/domains with that group, and add `192.0.2.0/24` under Subnet policies. Select the group and target instances, preview the per-instance changes, then apply. Clients querying Pi-hole from that subnet receive its native group policy without individual device registration. IPv6 networks such as `2001:db8::/64` are supported separately. Existing rules created through Pi-hole are listed too.

Use network addresses: `192.0.2.0/24` is accepted; `192.0.2.7/24` is rejected rather than silently widened. Host-only prefixes (`/32`, `/128`) and explicit default prefixes (`/0`) are accepted and shown in the review. Subnet renaming is deliberately excluded: add the new rule, then review removal of the old rule. This avoids a non-atomic rename or accidental changes to an unrelated entry.

## Preview and application

- Reads are independent per instance. Unavailable nodes are reported; their absence is never presented as an empty configuration.
- Group **names** are resolved to each instance's local IDs. Missing groups fail that target; no groups are created automatically.
- Preview reports create/update/delete/no-change/unavailable for each selected instance, including the current and intended groups/comment. Nothing is written by preview.
- Apply requires the returned configuration fingerprint. Relevant rule or group changes invalidate the preview with HTTP 409 before any writes.
- Only the selected CIDR entry is changed. Equivalent IPv6 spellings preserve the existing Pi-hole entry's original key. Duplicate equivalent entries are reported for manual review. MAC, hostname and other client entries are left alone.
- Successful writes are read back and administrative actions are audited. Partial failures remain visible; refresh and preview again to retry only outstanding changes. There is no durable background retry queue in this feature.
- Updates across independent Pi-holes are not atomic. Concurrent external writers can still race after the preflight reads; use one configuration writer. Read-back detects mismatches but cannot prevent every concurrent change.

All routes require the existing YAPD session. Preview and apply also require CSRF protection:

| Route | Purpose |
| --- | --- |
| `GET /api/clients/subnets` | Rules and per-instance configuration/availability |
| `POST /api/clients/subnets/preview` | Validate and calculate a change |
| `POST /api/clients/subnets/apply` | Apply the reviewed change |

Preview body: `{"client":"192.0.2.0/24","operation":"save","groups":["IoT"],"comment":"IoT policy","targetInstanceIds":["instance-id"]}`. Omit target IDs to use all sync-enabled instances. For deletion, use `operation: "delete"`; groups/comment are not needed. Apply accepts the same body plus `previewToken` from preview. This token is a configuration fingerprint for concurrency detection, not a substitute for authentication or authorization.

## Network behavior

Clients must query Pi-hole with their original source address preserved. Router forwarding, NAT or VPNs can hide it. Advertising Pi-hole through DHCP is an operator action; this feature never changes DHCP, routing, resolver advertisements or firewall rules. Pi-hole determines matching precedence; more specific IP rules can override a subnet. No hostname-to-IP or IP-to-MAC inference is used for membership. IPv4 policies do not cover queries from IPv6 addresses. Deleting a subnet entry falls back to other matching client rules or the Default group, not necessarily unfiltered DNS.

The existing MAC-based device inventory and group-member editor are unchanged. Those views do not yet expand subnet rules into effective per-device memberships. Use the subnet section to inspect the actual subnet assignments; do not interpret an empty device-level group list as an effective policy calculation.

The implementation uses the supported Pi-hole v6 client API, including URI-encoding the complete CIDR when updating/deleting. See the [official client API specification](https://github.com/pi-hole/FTL/blob/master/src/api/docs/content/specs/clients.yaml).

## Verification

Run `npm run test:subnets --workspace @yapd/api`. After building the API, run `npm run test:subnets-http --workspace @yapd/api`. Fixtures cover IPv4/IPv6 validation, group-ID differences, preview without mutations, stale previews, preservation of unrelated records, offline nodes, partial replication/retry, API rejection, read-back mismatch and idempotent deletion. HTTP tests exercise the compiled controller's authentication, CSRF and DTO validation. These tests use mocks and do not modify a production Pi-hole.
