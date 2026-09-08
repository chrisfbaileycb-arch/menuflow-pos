export interface WorkflowFieldSchemas {
  rewardExport: string[];
  couponExport: string[];
  payroll: string[];
  menuEngine: string;
}

export interface PosEcosystemProfile {
  name: string;
  architecture: string;
  systemRules: string;
  schemas: WorkflowFieldSchemas;
}

export const POS_PROFILES: Record<string, PosEcosystemProfile> = {
  toast: {
    name: "Toast POS",
    architecture:
      "Log-based, vertical relational database logs driven by sequential operational commands (CREATE, UPDATE, ATTACH).",
    systemRules:
      "Parent entities must be initialized or referenced via active sequence IDs before nesting or connecting child values. Reject horizontal combinations.",
    schemas: {
      rewardExport: [
        "Toast_Guest_ID",
        "First_Name",
        "Last_Name",
        "Email",
        "Phone",
        "Lifetime_Points",
        "Balance_Points",
        "Enrolled_Date_ISO",
      ],
      couponExport: [
        "Check_Number",
        "Order_ID",
        "Timestamp_UTC",
        "Discount_Service_ID",
        "Coupon_Code",
        "Amount_Deducted",
        "Net_Sales",
      ],
      payroll: [
        "Toast_Employee_ID",
        "Full_Name",
        "Job_Role_Code",
        "Shift_Date",
        "Clock_In_UTC",
        "Clock_Out_UTC",
        "Break_Mins",
        "Reg_Hours",
        "OT_Hours",
        "Tips_Cc",
      ],
      menuEngine:
        "Vertical processing: Row 1 = MENU_ITEM (flags, dayparts); Row 2 = MODIFIER_GROUP (links Op_ID); Row 3 = MODIFIER parameters.",
    },
  },
  square: {
    name: "Square for Restaurants",
    architecture:
      "Flat-file horizontal database rows utilizing internal catalog token keys (itm_, var_, mod_).",
    systemRules:
      "Modifiers, location visibility channels, and daypart parameters must be wrapped inside a single row text cell using semi-colons or commas.",
    schemas: {
      rewardExport: [
        "Square_Customer_ID",
        "Reference_ID",
        "Given_Name",
        "Family_Name",
        "Email",
        "Phone",
        "Loyalty_Points",
        "Current_Tier",
      ],
      couponExport: [
        "Transaction_ID",
        "Location_ID",
        "Created_At_ISO",
        "Discount_Catalog_ID",
        "Promotion_Name",
        "Code",
        "Amount_Money",
      ],
      payroll: [
        "Square_Team_Member_ID",
        "Name",
        "Role",
        "Work_Date",
        "Start_At_ISO",
        "End_At_ISO",
        "Paid_Break_Sec",
        "Unpaid_Break_Sec",
      ],
      menuEngine:
        "Single horizontal row line. Modifier options are referenced as a textual list indexing pre-existing dashboard properties.",
    },
  },
  clover: {
    name: "Clover Dining",
    architecture:
      "Relational database workbook structure consisting of multiple isolated, connected sheets/tabs.",
    systemRules:
      "Data blocks must be clearly segmented across separate structural spreadsheets linked through unique foreign string identifiers.",
    schemas: {
      rewardExport: [
        "Clover_Customer_ID",
        "First_Name",
        "Last_Name",
        "Email",
        "Phone",
        "Marketing_Opt_In",
        "Card_Number",
        "Points_Total",
      ],
      couponExport: [
        "Order_ID",
        "Employee_ID",
        "Checkout_Time",
        "Clover_Discount_ID",
        "Label",
        "Code",
        "Amount_Deducted",
        "Gross_Total",
      ],
      payroll: [
        "Clover_Employee_ID",
        "Employee_Name",
        "Role_Title",
        "Shift_ID",
        "In_Time",
        "Out_Time",
        "Break_Sec",
        "cc_Tips",
      ],
      menuEngine:
        "Multi-tab workbook (.xlsx): Tab 1 = ITEMS, Tab 2 = MODIFIER_GROUPS, Tab 3 = MODIFIERS intersecting via relational foreign keys.",
    },
  },
  aloha: {
    name: "NCR Aloha",
    architecture:
      "Positional, fixed-width DBF/flat-file transactional structures or structured enterprise XML nodes.",
    systemRules:
      "Enforce strict alphanumeric length parameters. Menu elements rely on exact item ID integers rather than descriptive names.",
    schemas: {
      rewardExport: [
        "Aloha_Loyalty_ID",
        "Alt_Phone",
        "Custom_First",
        "Custom_Last",
        "Email_Addr",
        "Current_Balance",
        "Lifetime_Tier",
      ],
      couponExport: [
        "Check_ID",
        "Term_ID",
        "Close_Bus_Date",
        "Comp_ID",
        "Promo_Code",
        "Discount_Deduction",
        "Gross_Sales",
      ],
      payroll: [
        "Aloha_Emp_Num",
        "Last_Name",
        "First_Name",
        "Job_ID",
        "Shift_Num",
        "Clock_In_Time",
        "Clock_Out_Time",
        "Declared_Cash_Tips",
      ],
      menuEngine:
        "Dayparts map to system pricing submenus (Daypart Modes). Modifiers link as rigid item sets pointing back to base menu matrices.",
    },
  },
  spoton: {
    name: "SpotOn Restaurant",
    architecture:
      "Unified relational JSON catalog payloads structured for proprietary hardware engines.",
    systemRules:
      "All labor schedules, room assignments, and nested components route through an integrated system stack mapped to an active transaction ledger.",
    schemas: {
      rewardExport: [
        "SpotOn_User_ID",
        "First_Name",
        "Last_Name",
        "Mobile_Phone",
        "Email",
        "Points_Balance",
        "Lifetime_Visits",
      ],
      couponExport: [
        "Ticket_ID",
        "Station_ID",
        "Timestamp",
        "Promotion_ID",
        "Code_String",
        "Calculated_Discount",
        "Ticket_Total",
      ],
      payroll: [
        "SpotOn_Emp_ID",
        "Full_Name",
        "Department",
        "Shift_Date",
        "In_ISO",
        "Out_ISO",
        "Actual_Hours",
        "CC_Tip_Payout",
      ],
      menuEngine:
        "Nested matrices combining spatial parameters (Room Maps) and active time periods (Dayparts) via associative array columns.",
    },
  },
  touchbistro: {
    name: "TouchBistro",
    architecture:
      "Local SQLite relational tables backed by secure cloud-synchronized snapshots.",
    systemRules:
      "Data structures must use precise, low-overhead array definitions compatible with mobile iPad OS environments.",
    schemas: {
      rewardExport: [
        "TB_Account_ID",
        "F_Name",
        "L_Name",
        "Email",
        "Telephone",
        "Points_Balance",
        "Rewards_Claimed_Count",
      ],
      couponExport: [
        "Bill_Number",
        "Table_Number",
        "Closed_At",
        "Discount_Type_ID",
        "Promo_Code",
        "Value_Deducted",
        "Tax_Deducted",
      ],
      payroll: [
        "TB_Staff_ID",
        "Staff_Name",
        "Passcode_Ref",
        "Role_Type",
        "Shift_Start",
        "Shift_End",
        "Break_Duration_Sec",
        "Cash_Owed",
      ],
      menuEngine:
        "Native table grids with explicit index pointers linking modifier groups directly to line items. Automated pricing schedules.",
    },
  },
  lightspeed: {
    name: "Lightspeed Restaurant",
    architecture:
      "Granular, ingredient-level relational schemas utilizing nested multi-property JSON trees.",
    systemRules:
      "Catalog configurations must connect menu choices down to raw warehouse inventory values.",
    schemas: {
      rewardExport: [
        "Lightspeed_Cust_ID",
        "Company",
        "First",
        "Last",
        "Email",
        "Phone",
        "Loyalty_Points_Total",
        "Active_Status",
      ],
      couponExport: [
        "Invoice_ID",
        "Register_ID",
        "Timestamp",
        "Discount_Rule_ID",
        "Code",
        "Deducted_Amount",
        "Tax_Inclusive_Total",
      ],
      payroll: [
        "LS_User_ID",
        "Name",
        "Operational_Role",
        "Date",
        "Clock_In",
        "Clock_Out",
        "Unpaid_Break_Mins",
        "Calculated_Pay",
      ],
      menuEngine:
        "Deeply segmented item entries with explicit link identifiers for multi-room availability and inventory depletion.",
    },
  },
  skytab: {
    name: "Shift4 Dine (SkyTab)",
    architecture:
      "Transaction-linked flat databases built around fixed-rate terminal hardware protocols.",
    systemRules:
      "Data payloads must anchor tightly to payment processing keys and merchant-level configuration tracking sheets.",
    schemas: {
      rewardExport: [
        "Shift4_Member_ID",
        "First_Name",
        "Last_Name",
        "Email",
        "Phone_Number",
        "Points_Accrued",
        "Account_Created",
      ],
      couponExport: [
        "Check_UUID",
        "Terminal_ID",
        "Settle_Time",
        "Shift4_Promo_ID",
        "Code",
        "Discount_Deduction",
        "Settle_Amount",
      ],
      payroll: [
        "SkyTab_Emp_ID",
        "Full_Name",
        "Job_Code",
        "Shift_Date",
        "In_Time_UTC",
        "Out_Time_UTC",
        "Hours_Total",
        "Tips_CC_Total",
      ],
      menuEngine:
        "Horizontal layout where modifiers map to pre-assigned terminal categories and dayparts track active terminal parameters.",
    },
  },
  micros: {
    name: "Oracle MICROS Simphony",
    architecture:
      "Enterprise-scale relational structures running on centralized, multi-venue database setups.",
    systemRules:
      "Database operations must use rigid corporate record indices, mapping properties uniformly across properties or outlets.",
    schemas: {
      rewardExport: [
        "Micros_Guest_GUID",
        "Enterprise_ID",
        "First_Name",
        "Last_Name",
        "Email",
        "Phone",
        "Loyalty_Balance_Points",
      ],
      couponExport: [
        "RVC_Number",
        "Check_Seq",
        "Business_Date",
        "Object_Num",
        "Coupon_Code",
        "Reduction_Amount",
        "Net_Sales",
      ],
      payroll: [
        "Micros_Emp_Obj_Num",
        "Name_First",
        "Name_Last",
        "Job_Seq",
        "Shift_Seq",
        "Punch_In",
        "Punch_Out",
        "Tips_Declared",
      ],
      menuEngine:
        "Hierarchical structure mapping items globally across the database into Revenue Centers and specific Daypart Schedules.",
    },
  },
  revel: {
    name: "Revel Systems",
    architecture:
      "Cloud-native structural databases optimized for extensive, open-API data extraction.",
    systemRules:
      "Data transformations must handle granular pricing calculations and third-party delivery override metrics seamlessly.",
    schemas: {
      rewardExport: [
        "Revel_Customer_ID",
        "Code",
        "First_Name",
        "Last_Name",
        "Email",
        "Phone",
        "Point_Balance",
        "Lifetime_Spend",
      ],
      couponExport: [
        "Order_ID",
        "Station_ID",
        "Close_Time",
        "Discount_Type_UUID",
        "Code_Text",
        "Discount_Value",
        "Final_Total",
      ],
      payroll: [
        "Revel_Emp_ID",
        "First_Name",
        "Last_Name",
        "Role",
        "Work_Date",
        "Clock_In",
        "Clock_Out",
        "Break_Duration",
        "Tips_CC",
      ],
      menuEngine:
        "Absolute tree model where items use property tokens for Custom Menus, and modifiers map via multi-level parent structures.",
    },
  },
};
