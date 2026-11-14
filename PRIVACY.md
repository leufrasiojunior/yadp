# Privacy Policy for YAPD & YAPD Sentinel

Last updated: November 2026

## Overview
**YAPD** (*Yet Another Pi-hole Dashboard*) and **YAPD Sentinel** (*Browser Extension*) are committed to protecting your privacy. This Privacy Policy explains our practices regarding user data.

## No Data Collection or Transmission to Developers
- **Zero Third-Party Telemetry:** We do not collect, store, sell, or transmit any personal data, browsing history, web traffic, or device information to external servers, cloud services, or developers.
- **Local Operation:** YAPD Sentinel operates entirely within your browser. Network inspection and domain analysis are performed locally on your device in real time.
- **Self-Hosted Architecture:** Any network communication initiated by YAPD or the extension occurs strictly between your browser and your own self-hosted YAPD instance or local Pi-hole v6+ DNS filtering server on your private network (LAN).

## Permissions Usage in YAPD Sentinel
- **storage:** Used exclusively to store your personal extension settings, display preferences, and local instance connection endpoints.
- **activeTab & tabs:** Used to display domain metrics and request inspection for the currently active tab or open tabs within the extension popup.
- **alarms:** Used to run a lightweight periodic background task to synchronize filter lists from your configured self-hosted instance.
- **webRequest & host permissions (`<all_urls>`):** Used strictly to passively detect ad and tracking domains requested during your browsing sessions so you can inspect and manage your local DNS blocklists.

## Open Source and Auditability
All source code for YAPD and YAPD Sentinel is 100% open-source and freely auditable at [https://github.com/leufrasiojunior/yadp](https://github.com/leufrasiojunior/yadp).

## Contact
If you have any questions or feedback regarding this policy, please open an issue at:
[https://github.com/leufrasiojunior/yadp/issues](https://github.com/leufrasiojunior/yadp/issues)
