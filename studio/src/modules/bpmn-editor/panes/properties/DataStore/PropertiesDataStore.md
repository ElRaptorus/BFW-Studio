---
title: Data Store
---

# Data Store

![Data Store](DataStore.svg)

A `Data Store` represents data that lives **outside** the process, in another system — unlike a [Data Object](help://bpmn/properties/data_object), whose data belongs to the process run itself.

The Engine accepts Data Stores and the associations that point at them, and never reads or writes them at runtime. The Bifrost Forge World Fabricator surveys them so a generated application can connect them later.
