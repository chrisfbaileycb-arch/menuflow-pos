# POS Operational Mapping Matrix

| POS Platform Target | Primary File Architecture | Processing Paradigm | Core Workflow Keys |
| :--- | :--- | :--- | :--- |
| **Toast** | Sequential Flat CSV | Multi-Row Commands | `[Toast_Guest_ID]`, `[Check_Number]`, `[Toast_Employee_ID]` |
| **Square** | Wide Matrix CSV | Horizontal Data Fields | `[Square_Customer_ID]`, `[Transaction_ID]`, `[Square_Team_Member_ID]` |
| **Clover** | Multi-Tab Workbooks | Relational Tables | `[Clover_Customer_ID]`, `[Order_ID]`, `[Clover_Employee_ID]` |
| **NCR Aloha** | Fixed-Width DBF / XML | Positional Key Indices | `[Aloha_Loyalty_ID]`, `[Check_ID]`, `[Aloha_Emp_Num]` |
| **SpotOn** | Unified Nested JSON | Core Integrated Stack | `[SpotOn_User_ID]`, `[Ticket_ID]`, `[SpotOn_Emp_ID]` |
| **TouchBistro** | Local SQLite / Cloud Sync | Low-Overhead Key Grids | `[TB_Account_ID]`, `[Bill_Number]`, `[TB_Staff_ID]` |
| **Lightspeed** | Ingredient-Linked JSON | Production Level Tracking | `[Lightspeed_Cust_ID]`, `[Invoice_ID]`, `[LS_User_ID]` |
| **Shift4 SkyTab** | Payment-Tied DB Arrays | Processing Matrix Anchors | `[Shift4_Member_ID]`, `[Check_UUID]`, `[SkyTab_Emp_ID]` |
| **Oracle MICROS** | Multi-Venue Database | Corporate Record Indices | `[Micros_Guest_GUID]`, `[RVC_Number]`, `[Micros_Emp_Obj_Num]` || **Revel Systems**| Open-API Relational Trees | Multi-Tier Overrides | `[Revel_Customer_ID]`, `[Order_ID]`, `[Revel_Emp_ID]` |
