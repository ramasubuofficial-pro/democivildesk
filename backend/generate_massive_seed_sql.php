<?php
// CivilDesk ERP - Massive 4-Year Seed Data Generator with 200 Materials, 10 BOQs, Detailed Items & Daily Operations
// Fully Schema-Aligned with MySQL & civil_pro.sql

$outputFile = dirname(__DIR__) . '/backend/db/demo_seed_data.sql';
$fp = fopen($outputFile, 'w');

function writeLine($fp, $str) {
    fwrite($fp, $str . "\n");
}

writeLine($fp, "-- ============================================================================");
writeLine($fp, "-- CIVIL DESK ERP - 4-YEAR EXTENSIVE PRODUCTION SEED DATASET");
writeLine($fp, "-- Features: 200 Materials, 10 Detailed BOQs, 100+ BOQ Items, Daily Operations (4 Years)");
writeLine($fp, "-- Projects Breakdown:");
writeLine($fp, "--   1. KMC hospital (PRJ-KRR-001)   -> COMPLETED   (100.0% Progress, 2023-2024)");
writeLine($fp, "--   2. Valluvar hotel (PRJ-KRR-002) -> COMPLETED   (100.0% Progress, 2024-2025)");
writeLine($fp, "--   3. Bosch Showroom (PRJ-KRR-003) -> IN PROGRESS ( 68.5% Progress, 2025-2026)");
writeLine($fp, "--   4. Chettinad college (PRJ-KRR-004)-> DRAFT / PLANNED (0.0% Progress, 2026-2028)");
writeLine($fp, "-- ============================================================================\n");

writeLine($fp, "SET FOREIGN_KEY_CHECKS = 0;");
writeLine($fp, "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n");

// ----------------------------------------------------------------------------
// 1. COMPANIES & BRANCHES
// ----------------------------------------------------------------------------
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 1. COMPANIES & BRANCHES");
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "INSERT INTO `companies` (`id`, `company_code`, `company_name`, `legal_name`, `email`, `phone`, `is_active`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1, 'CMP-001', 'CivilDesk Constructions Pvt Ltd', 'CivilDesk ERP Demo Pvt Ltd', 'admin@civildesk.in', '9842411111', 1, '2023-01-01 00:00:00', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `company_name` = VALUES(`company_name`);\n");

writeLine($fp, "INSERT INTO `branches` (`id`, `company_id`, `branch_code`, `branch_name`, `email`, `phone`, `is_head_office`, `is_active`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1, 1, 'BR-KRR-01', 'Karur Main Branch', 'karur@civildesk.in', '9842411112', 1, 1, '2023-01-01 00:00:00', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `branch_name` = VALUES(`branch_name`);\n");

// ----------------------------------------------------------------------------
// 2. USERS, ROLES & SHIELD AUTH
// ----------------------------------------------------------------------------
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 2. USERS, ROLES & SHIELD AUTH IDENTITIES");
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "INSERT INTO `users_user_type_masters` (`id`, `user_type_code`, `user_type_name`, `is_active`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1, 'COMPANY_ADMIN', 'Company Administrator', 1, '2023-01-01 00:00:00', NOW()),");
writeLine($fp, "(2, 'PROJECT_MANAGER', 'Project Manager', 1, '2023-01-01 00:00:00', NOW()),");
writeLine($fp, "(3, 'SITE_ENGINEER', 'Site Engineer', 1, '2023-01-01 00:00:00', NOW()),");
writeLine($fp, "(4, 'ACCOUNTANT', 'Project Accountant', 1, '2023-01-01 00:00:00', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `user_type_name` = VALUES(`user_type_name`);\n");

writeLine($fp, "INSERT INTO `user_statuses` (`id`, `status_code`, `status_name`, `is_login_allowed`, `is_active`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1, 'ACTIVE', 'Active', 1, 1, '2023-01-01 00:00:00', NOW()),");
writeLine($fp, "(2, 'INACTIVE', 'Inactive', 0, 1, '2023-01-01 00:00:00', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `status_name` = VALUES(`status_name`);\n");

$pwdHash = password_hash('Admin@12345', PASSWORD_DEFAULT); // Password: Admin@12345
writeLine($fp, "INSERT INTO `users` (`id`, `company_id`, `default_branch_id`, `username`, `email`, `password_hash`, `first_name`, `last_name`, `designation`, `user_type_id`, `user_status_id`, `active`, `is_super_admin`, `is_active`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1, 1, 1, 'superadmin', 'superadmin@civilpro.com', '{$pwdHash}', 'Super', 'Administrator', 'System Administrator', 1, 1, 1, 1, 1, '2023-01-01 00:00:00', NOW()),");
writeLine($fp, "(2, 1, 1, 'pm_karur', 'pm.karur@civildesk.in', '{$pwdHash}', 'Ramesh', 'Kumar', 'Senior Project Manager', 2, 1, 1, 0, 1, '2023-01-01 00:00:00', NOW()),");
writeLine($fp, "(3, 1, 1, 'site_eng', 'engineer.karur@civildesk.in', '{$pwdHash}', 'Karthik', 'S', 'Senior Site Engineer', 3, 1, 1, 0, 1, '2023-01-01 00:00:00', NOW()),");
writeLine($fp, "(4, 1, 1, 'accounts', 'accounts.karur@civildesk.in', '{$pwdHash}', 'Suresh', 'Babu', 'Project Accounts Lead', 4, 1, 1, 0, 1, '2023-01-01 00:00:00', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `email` = VALUES(`email`), `password_hash` = VALUES(`password_hash`);\n");

writeLine($fp, "INSERT INTO `auth_identities` (`id`, `user_id`, `type`, `secret`, `secret2`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1, 1, 'email_password', 'superadmin@civilpro.com', '{$pwdHash}', '2023-01-01 00:00:00', NOW()),");
writeLine($fp, "(2, 2, 'email_password', 'pm.karur@civildesk.in', '{$pwdHash}', '2023-01-01 00:00:00', NOW()),");
writeLine($fp, "(3, 3, 'email_password', 'engineer.karur@civildesk.in', '{$pwdHash}', '2023-01-01 00:00:00', NOW()),");
writeLine($fp, "(4, 4, 'email_password', 'accounts.karur@civildesk.in', '{$pwdHash}', '2023-01-01 00:00:00', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `secret` = VALUES(`secret`), `secret2` = VALUES(`secret2`);\n");

// ----------------------------------------------------------------------------
// 3. FINANCIAL YEARS, CLIENTS & PROJECT TYPES
// ----------------------------------------------------------------------------
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 3. FINANCIAL YEARS & CLIENTS");
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "INSERT INTO `financial_years` (`id`, `company_id`, `year_code`, `year_name`, `start_date`, `end_date`, `is_current`, `is_active`, `created_by`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1, 1, 'FY-2022-23', 'Financial Year 2022-2023', '2022-04-01', '2023-03-31', 0, 1, 1, '2022-04-01', NOW()),");
writeLine($fp, "(2, 1, 'FY-2023-24', 'Financial Year 2023-2024', '2023-04-01', '2024-03-31', 0, 1, 1, '2023-04-01', NOW()),");
writeLine($fp, "(3, 1, 'FY-2024-25', 'Financial Year 2024-2025', '2024-04-01', '2025-03-31', 0, 1, 1, '2024-04-01', NOW()),");
writeLine($fp, "(4, 1, 'FY-2025-26', 'Financial Year 2025-2026', '2025-04-01', '2026-03-31', 0, 1, 1, '2025-04-01', NOW()),");
writeLine($fp, "(5, 1, 'FY-2026-27', 'Financial Year 2026-2027', '2026-04-01', '2027-03-31', 1, 1, 1, '2026-04-01', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `year_name` = VALUES(`year_name`);\n");

writeLine($fp, "INSERT INTO `client_statuses` (`id`, `status_code`, `status_name`, `is_active`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1, 'ACTIVE', 'Active Client', 1, '2023-01-01', NOW()),");
writeLine($fp, "(2, 'INACTIVE', 'Inactive Client', 1, '2023-01-01', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `status_name` = VALUES(`status_name`);\n");

writeLine($fp, "INSERT INTO `clients` (`id`, `company_id`, `branch_id`, `client_code`, `client_name`, `legal_name`, `client_type_id`, `industry_type`, `gstin`, `pan`, `email`, `phone`, `billing_currency`, `payment_terms_days`, `credit_limit`, `client_status_id`, `created_by`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1, 1, 1, 'CLI-KRR-001', 'Karur Medical & Health Foundation', 'Karur Medical Foundation Trust', 1, 'Healthcare & Hospitals', '33AAATK1234F1Z1', 'AAATK1234F', 'director@kmchospital.com', '9842412345', 'INR', 30, 5000000.00, 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(2, 1, 1, 'CLI-KRR-002', 'Valluvar Hospitality & Resorts Ltd', 'Valluvar Hotels & Resorts India Pvt Ltd', 1, 'Hospitality & Commercial', '33AABCV5678H1Z2', 'AABCV5678H', 'valluvan@valluvarhotels.com', '9842412346', 'INR', 30, 6000000.00, 1, 1, '2024-01-01', NOW()),");
writeLine($fp, "(3, 1, 1, 'CLI-KRR-003', 'Kongu Automotive Retailers Karur', 'Kongu Auto Showrooms LLP', 1, 'Automobile Dealership', '33AACCK9988G1Z3', 'AACCK9988G', 'sales@kongubosch.com', '9842412347', 'INR', 30, 3000000.00, 1, 1, '2025-01-01', NOW()),");
writeLine($fp, "(4, 1, 1, 'CLI-KRR-004', 'Chettinad Educational Trust', 'Chettinad Higher Education Foundation', 1, 'Higher Education & Research', '33AAATC7766J1Z4', 'AAATC7766J', 'registrar@chettinadcampus.edu', '9842412348', 'INR', 45, 10000000.00, 1, 1, '2026-01-01', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `client_name` = VALUES(`client_name`);\n");

writeLine($fp, "INSERT INTO `project_types` (`id`, `company_id`, `project_type_code`, `project_type_name`, `billing_method_id`, `default_duration_days`, `description`, `display_order`, `is_active`, `created_by`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1, 1, 'HEALTHCARE', 'Hospital & Healthcare Infrastructure', 1, 450, 'Multi-speciality hospital and clinical facilities', 1, 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(2, 1, 'HOSPITALITY', 'Hotels, Banquets & Commercial Resorts', 1, 500, 'Hotels, convention centres and luxury banquets', 2, 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(3, 1, 'COMMERCIAL', 'Automotive Showrooms & Retail Outlets', 1, 360, 'Commercial retail showrooms and automobile hubs', 3, 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(4, 1, 'INSTITUTIONAL', 'University & College Academic Campuses', 1, 600, 'Colleges, educational institutions and student complexes', 4, 1, 1, '2023-01-01', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `project_type_name` = VALUES(`project_type_name`);\n");

// ----------------------------------------------------------------------------
// 4. FOUR PROJECTS
// ----------------------------------------------------------------------------
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 4. FOUR PROJECTS (2 COMPLETED, 1 IN PROGRESS, 1 DRAFT)");
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "INSERT INTO `projects` ");
writeLine($fp, "(`id`, `company_id`, `branch_id`, `client_id`, `project_type_id`, `financial_year_id`, `project_code`, `project_name`, `description`, `work_order_no`, `work_order_date`, `planned_start_date`, `actual_start_date`, `expected_completion_date`, `actual_completion_date`, `contract_value`, `approved_budget`, `billing_method_id`, `retention_percentage`, `tax_percentage`, `currency_code`, `priority_id`, `project_status_id`, `progress_percentage`, `created_by`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(101, 1, 1, 1, 1, 2, 'PRJ-KRR-001', 'KMC hospital', 'Multi-Speciality 250-bed hospital expansion with modern ICU, modular operation theatres, and diagnostics wing in Gandhigramam, Karur.', 'WO-KMC-2023-01', '2023-01-10', '2023-01-15', '2023-01-15', '2024-03-31', '2024-03-28', 14500000.00, 9500000.00, 1, 5.00, 18.00, 'INR', 1, 3, 100.00, 1, '2023-01-10', NOW()),");
writeLine($fp, "(102, 1, 1, 2, 2, 3, 'PRJ-KRR-002', 'Valluvar hotel', 'Premium 4-Star luxury hotel, grand banquet hall, multi-level car parking, and rooftop restaurant on Kovai Main Road, Karur.', 'WO-VAL-2024-02', '2024-01-20', '2024-02-01', '2024-02-01', '2025-05-30', '2025-05-25', 18000000.00, 12000000.00, 1, 5.00, 18.00, 'INR', 1, 3, 100.00, 1, '2024-01-20', NOW()),");
writeLine($fp, "(103, 1, 1, 3, 3, 4, 'PRJ-KRR-003', 'Bosch Showroom', 'Modern Bosch automotive sales showroom, interactive customer gallery, automated service bays, and bodyshop on Karur Bypass Road.', 'WO-BSH-2025-03', '2025-05-15', '2025-06-01', '2025-06-01', '2026-12-31', NULL, 8500000.00, 6000000.00, 1, 5.00, 18.00, 'INR', 1, 1, 68.50, 1, '2025-05-15', NOW()),");
writeLine($fp, "(104, 1, 1, 4, 4, 5, 'PRJ-KRR-004', 'Chettinad college', 'Integrated engineering and arts college academic block, central digital library, smart laboratories, and student hostel campus in Puliyur, Karur.', 'WO-CHT-2026-04', '2026-09-01', '2026-11-01', NULL, '2028-06-30', NULL, 25000000.00, 18000000.00, 1, 5.00, 18.00, 'INR', 2, 4, 0.00, 1, '2026-09-01', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `project_name` = VALUES(`project_name`), `project_status_id` = VALUES(`project_status_id`), `progress_percentage` = VALUES(`progress_percentage`);\n");

// ----------------------------------------------------------------------------
// 5. PROJECT SITES (8 SITES - 2 PER PROJECT)
// ----------------------------------------------------------------------------
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 5. PROJECT SITES (8 SITES - 2 PER PROJECT)");
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "INSERT INTO `project_sites` (`id`, `company_id`, `project_id`, `site_code`, `site_name`, `site_type_id`, `address_line1`, `city`, `district`, `state_name`, `state_code`, `country_code`, `postal_code`, `site_status_id`, `progress_percentage`, `is_primary`, `created_by`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(201, 1, 101, 'STE-KMC-01', 'KMC Inpatient & ICU Block (Gandhigramam)', 1, 'Gandhigramam South', 'Karur', 'Karur', 'Tamil Nadu', 'TN', 'IND', '639004', 3, 100.00, 1, 1, '2023-01-15', NOW()),");
writeLine($fp, "(202, 1, 101, 'STE-KMC-02', 'KMC Doctors Quarters & Pharmacy Wing (Kovai Road)', 1, 'Near Light House Corner, Kovai Road', 'Karur', 'Karur', 'Tamil Nadu', 'TN', 'IND', '639002', 3, 100.00, 0, 1, '2023-01-15', NOW()),");
writeLine($fp, "(203, 1, 102, 'STE-VAL-01', 'Valluvar Grand Hotel Block (Kovai Main Road)', 1, 'Kovai Main Road', 'Karur', 'Karur', 'Tamil Nadu', 'TN', 'IND', '639002', 3, 100.00, 1, 1, '2024-02-01', NOW()),");
writeLine($fp, "(204, 1, 102, 'STE-VAL-02', 'Valluvar Convention Center & Multi-Level Parking', 1, 'Thanthonimalai Bypass Junction', 'Karur', 'Karur', 'Tamil Nadu', 'TN', 'IND', '639005', 3, 100.00, 0, 1, '2024-02-01', NOW()),");
writeLine($fp, "(205, 1, 103, 'STE-BSH-01', 'Bosch Sales & Experience Center (Karur Bypass)', 1, 'Karur Bypass Road, Near Amaravathi Bridge', 'Karur', 'Karur', 'Tamil Nadu', 'TN', 'IND', '639001', 1, 68.50, 1, 1, '2025-06-01', NOW()),");
writeLine($fp, "(206, 1, 103, 'STE-BSH-02', 'Bosch Express Service & Bodyshop (Vengamedu)', 1, 'Industrial Estate Road, Vengamedu', 'Karur', 'Karur', 'Tamil Nadu', 'TN', 'IND', '639006', 1, 68.50, 0, 1, '2025-06-01', NOW()),");
writeLine($fp, "(207, 1, 104, 'STE-CHT-01', 'Chettinad Academic & Laboratory Complex (Puliyur)', 1, 'Chettinad Campus, Trichy-Karur Main Road', 'Puliyur', 'Karur', 'Tamil Nadu', 'TN', 'IND', '639114', 4, 0.00, 1, 1, '2026-09-01', NOW()),");
writeLine($fp, "(208, 1, 104, 'STE-CHT-02', 'Chettinad Student Hostel & Sports Stadium', 1, 'North Campus Green Boulevard', 'Puliyur', 'Karur', 'Tamil Nadu', 'TN', 'IND', '639114', 4, 0.00, 0, 1, '2026-09-01', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `site_name` = VALUES(`site_name`), `site_status_id` = VALUES(`site_status_id`);\n");

// ----------------------------------------------------------------------------
// 6. SITE WORK ZONES (24 ZONES - 3 PER SITE)
// ----------------------------------------------------------------------------
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 6. SITE WORK ZONES (24 ZONES - 3 PER SITE)");
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "INSERT INTO `site_work_zones` (`id`, `company_id`, `project_id`, `site_id`, `zone_code`, `zone_name`, `zone_type_id`, `status_id`, `progress_percentage`, `display_order`, `is_active`, `created_by`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(301, 1, 101, 201, 'ZON-KMC-01', 'OPD & Emergency Ground Floor', 1, 3, 100.00, 1, 1, 1, '2023-01-15', NOW()),");
writeLine($fp, "(302, 1, 101, 201, 'ZON-KMC-02', 'ICU & Modular Operation Theatres', 1, 3, 100.00, 2, 1, 1, '2023-01-15', NOW()),");
writeLine($fp, "(303, 1, 101, 201, 'ZON-KMC-03', 'Diagnostic & Radiology Basement', 1, 3, 100.00, 3, 1, 1, '2023-01-15', NOW()),");
writeLine($fp, "(304, 1, 101, 202, 'ZON-KMC-04', 'Foundation & Substructure Basement', 1, 3, 100.00, 1, 1, 1, '2023-01-15', NOW()),");
writeLine($fp, "(305, 1, 101, 202, 'ZON-KMC-05', 'Doctors Residential Suites Floors 1-4', 1, 3, 100.00, 2, 1, 1, '2023-01-15', NOW()),");
writeLine($fp, "(306, 1, 101, 202, 'ZON-KMC-06', 'Central Pharmacy & Cold Storage', 1, 3, 100.00, 3, 1, 1, '2023-01-15', NOW()),");
writeLine($fp, "(307, 1, 102, 203, 'ZON-VAL-01', 'Grand Banquet & Reception Lobby', 1, 3, 100.00, 1, 1, 1, '2024-02-01', NOW()),");
writeLine($fp, "(308, 1, 102, 203, 'ZON-VAL-02', 'Executive Guest Suites Floors 1-6', 1, 3, 100.00, 2, 1, 1, '2024-02-01', NOW()),");
writeLine($fp, "(309, 1, 102, 203, 'ZON-VAL-03', 'Rooftop Infinity Pool & Sky Lounge', 1, 3, 100.00, 3, 1, 1, '2024-02-01', NOW()),");
writeLine($fp, "(310, 1, 102, 204, 'ZON-VAL-04', 'Convention Auditorium Superstructure', 1, 3, 100.00, 1, 1, 1, '2024-02-01', NOW()),");
writeLine($fp, "(311, 1, 102, 204, 'ZON-VAL-05', 'Multi-Level Basement Car Parking', 1, 3, 100.00, 2, 1, 1, '2024-02-01', NOW()),");
writeLine($fp, "(312, 1, 102, 204, 'ZON-VAL-06', 'Commercial Kitchen & Catering Facility', 1, 3, 100.00, 3, 1, 1, '2024-02-01', NOW()),");
writeLine($fp, "(313, 1, 103, 205, 'ZON-BSH-01', 'Main Product Display & Customer Lounge', 1, 1, 75.00, 1, 1, 1, '2025-06-01', NOW()),");
writeLine($fp, "(314, 1, 103, 205, 'ZON-BSH-02', 'Delivery Bay & Accessories Showcase', 1, 1, 70.00, 2, 1, 1, '2025-06-01', NOW()),");
writeLine($fp, "(315, 1, 103, 205, 'ZON-BSH-03', 'Administrative Offices & Billing Counter', 1, 1, 65.00, 3, 1, 1, '2025-06-01', NOW()),");
writeLine($fp, "(316, 1, 103, 206, 'ZON-BSH-04', 'Mechanical Service Bays 1-8', 1, 1, 68.00, 1, 1, 1, '2025-06-01', NOW()),");
writeLine($fp, "(317, 1, 103, 206, 'ZON-BSH-05', 'Automated Paint Booth & Body Repair', 1, 1, 62.00, 2, 1, 1, '2025-06-01', NOW()),");
writeLine($fp, "(318, 1, 103, 206, 'ZON-BSH-06', 'OEM Spare Parts Warehouse', 1, 1, 65.00, 3, 1, 1, '2025-06-01', NOW()),");
writeLine($fp, "(319, 1, 104, 207, 'ZON-CHT-01', 'Smart Classrooms & Lecture Halls Wing A', 1, 4, 0.00, 1, 1, 1, '2026-09-01', NOW()),");
writeLine($fp, "(320, 1, 104, 207, 'ZON-CHT-02', 'Engineering & AI Computer Labs Wing B', 1, 4, 0.00, 2, 1, 1, '2026-09-01', NOW()),");
writeLine($fp, "(321, 1, 104, 207, 'ZON-CHT-03', 'Central Digital Library & Seminar Hall', 1, 4, 0.00, 3, 1, 1, '2026-09-01', NOW()),");
writeLine($fp, "(322, 1, 104, 208, 'ZON-CHT-04', 'Boys Hostel Residential Block', 1, 4, 0.00, 1, 1, 1, '2026-09-01', NOW()),");
writeLine($fp, "(323, 1, 104, 208, 'ZON-CHT-05', 'Girls Hostel Residential Block', 1, 4, 0.00, 2, 1, 1, '2026-09-01', NOW()),");
writeLine($fp, "(324, 1, 104, 208, 'ZON-CHT-06', 'Indoor Sports Stadium & Dining Hall', 1, 4, 0.00, 3, 1, 1, '2026-09-01', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `zone_name` = VALUES(`zone_name`), `progress_percentage` = VALUES(`progress_percentage`);\n");

// ----------------------------------------------------------------------------
// 7. WORK LOCATIONS (24 LOCATIONS)
// ----------------------------------------------------------------------------
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 7. WORK LOCATIONS (24 LOCATIONS)");
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "INSERT INTO `work_locations` (`id`, `company_id`, `project_id`, `site_id`, `zone_id`, `location_code`, `location_name`, `location_type_id`, `status_id`, `progress_percentage`, `display_order`, `is_active`, `created_by`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(401, 1, 101, 201, 301, 'LOC-KMC-01', 'Emergency Triage & Trauma Bays', 1, 3, 100.00, 1, 1, 1, '2023-01-15', NOW()),");
writeLine($fp, "(402, 1, 101, 201, 302, 'LOC-KMC-02', 'OT Complex 1-4 & Recovery Ward', 1, 3, 100.00, 2, 1, 1, '2023-01-15', NOW()),");
writeLine($fp, "(403, 1, 101, 201, 303, 'LOC-KMC-03', 'MRI, CT-Scan & Radiation Bunker', 1, 3, 100.00, 3, 1, 1, '2023-01-15', NOW()),");
writeLine($fp, "(404, 1, 101, 202, 304, 'LOC-KMC-04', 'Retaining Wall & Deep Pile Caps', 1, 3, 100.00, 1, 1, 1, '2023-01-15', NOW()),");
writeLine($fp, "(405, 1, 101, 202, 305, 'LOC-KMC-05', 'Apartment Suites 101 to 408', 1, 3, 100.00, 2, 1, 1, '2023-01-15', NOW()),");
writeLine($fp, "(406, 1, 101, 202, 306, 'LOC-KMC-06', 'Automated Drug Distribution Bay', 1, 3, 100.00, 3, 1, 1, '2023-01-15', NOW()),");
writeLine($fp, "(407, 1, 102, 203, 307, 'LOC-VAL-01', 'Grand Ballroom & Stage Setup', 1, 3, 100.00, 1, 1, 1, '2024-02-01', NOW()),");
writeLine($fp, "(408, 1, 102, 203, 308, 'LOC-VAL-02', 'Presidential Suites 501-506', 1, 3, 100.00, 2, 1, 1, '2024-02-01', NOW()),");
writeLine($fp, "(409, 1, 102, 203, 309, 'LOC-VAL-03', 'Poolside Deck & Barbecue Gazebo', 1, 3, 100.00, 3, 1, 1, '2024-02-01', NOW()),");
writeLine($fp, "(410, 1, 102, 204, 310, 'LOC-VAL-04', '2000-Seater Auditorium Main Hall', 1, 3, 100.00, 1, 1, 1, '2024-02-01', NOW()),");
writeLine($fp, "(411, 1, 102, 204, 311, 'LOC-VAL-05', 'Basement Levels B1 & B2 Ramp', 1, 3, 100.00, 2, 1, 1, '2024-02-01', NOW()),");
writeLine($fp, "(412, 1, 102, 204, 312, 'LOC-VAL-06', 'Cold Storage & Bakery Line', 1, 3, 100.00, 3, 1, 1, '2024-02-01', NOW()),");
writeLine($fp, "(413, 1, 103, 205, 313, 'LOC-BSH-01', 'Central Car Turntable Display', 1, 1, 75.00, 1, 1, 1, '2025-06-01', NOW()),");
writeLine($fp, "(414, 1, 103, 205, 314, 'LOC-BSH-02', 'Customer Delivery Chamber', 1, 1, 70.00, 2, 1, 1, '2025-06-01', NOW()),");
writeLine($fp, "(415, 1, 103, 205, 315, 'LOC-BSH-03', 'Finance & Insurance Cubicles', 1, 1, 65.00, 3, 1, 1, '2025-06-01', NOW()),");
writeLine($fp, "(416, 1, 103, 206, 316, 'LOC-BSH-04', 'Hydraulic 2-Post & 4-Post Lift Bays', 1, 1, 68.00, 1, 1, 1, '2025-06-01', NOW()),");
writeLine($fp, "(417, 1, 103, 206, 317, 'LOC-BSH-05', 'Baking Oven & Paint Prep Zone', 1, 1, 62.00, 2, 1, 1, '2025-06-01', NOW()),");
writeLine($fp, "(418, 1, 103, 206, 318, 'LOC-BSH-06', 'High-Density Racks & FIFO Storage', 1, 1, 65.00, 3, 1, 1, '2025-06-01', NOW()),");
writeLine($fp, "(419, 1, 104, 207, 319, 'LOC-CHT-01', 'Smart Audio-Visual Gallery 1-4', 1, 4, 0.00, 1, 1, 1, '2026-09-01', NOW()),");
writeLine($fp, "(420, 1, 104, 207, 320, 'LOC-CHT-02', 'Robotics & IoT Center of Excellence', 1, 4, 0.00, 2, 1, 1, '2026-09-01', NOW()),");
writeLine($fp, "(421, 1, 104, 207, 321, 'LOC-CHT-03', 'E-Library & Archival Reading Hall', 1, 4, 0.00, 3, 1, 1, '2026-09-01', NOW()),");
writeLine($fp, "(422, 1, 104, 208, 322, 'LOC-CHT-04', 'Block A 4-Bed Dormitory Rooms', 1, 4, 0.00, 1, 1, 1, '2026-09-01', NOW()),");
writeLine($fp, "(423, 1, 104, 208, 323, 'LOC-CHT-05', 'Block B 2-Bed Attached Bath Rooms', 1, 4, 0.00, 2, 1, 1, '2026-09-01', NOW()),");
writeLine($fp, "(424, 1, 104, 208, 324, 'LOC-CHT-06', 'Badminton Courts & Steam Mess Hall', 1, 4, 0.00, 3, 1, 1, '2026-09-01', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `location_name` = VALUES(`location_name`), `progress_percentage` = VALUES(`progress_percentage`);\n");

// ----------------------------------------------------------------------------
// 8. UNITS OF MEASUREMENT & 14 MATERIAL CATEGORIES
// ----------------------------------------------------------------------------
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 8. UNITS OF MEASUREMENT & MATERIAL CATEGORIES");
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "INSERT INTO `units_of_measurement` (`id`, `company_id`, `unit_code`, `unit_name`, `unit_symbol`, `unit_type_id`, `decimal_places`, `is_active`, `created_at`, `updated_at`) VALUES");
$uoms = [
    [1, 'BAG', 'Bags (50kg)', 'Bag', 1, 0],
    [2, 'MT', 'Metric Tonne', 'MT', 1, 3],
    [3, 'CUM', 'Cubic Metre', 'm3', 2, 3],
    [4, 'SQM', 'Square Metre', 'm2', 3, 2],
    [5, 'SQFT', 'Square Feet', 'sqft', 3, 2],
    [6, 'RMT', 'Running Metre', 'Rmt', 4, 2],
    [7, 'NOS', 'Numbers / Pieces', 'Nos', 5, 0],
    [8, 'LTR', 'Litres', 'Ltr', 2, 2],
    [9, 'KG', 'Kilograms', 'Kg', 1, 2],
    [10, 'SET', 'Set / Assemblies', 'Set', 5, 0],
    [11, 'BDL', 'Bundles', 'Bdl', 5, 0],
    [12, 'TRIP', 'Truck Tipper Trip', 'Trip', 2, 0]
];
$uomRows = [];
foreach ($uoms as $u) {
    $uomRows[] = "({$u[0]}, 1, '{$u[1]}', '{$u[2]}', '{$u[3]}', {$u[4]}, {$u[5]}, 1, '2023-01-01', NOW())";
}
writeLine($fp, implode(",\n", $uomRows));
writeLine($fp, "ON DUPLICATE KEY UPDATE `unit_name` = VALUES(`unit_name`);\n");

writeLine($fp, "INSERT INTO `material_categories` (`id`, `company_id`, `category_code`, `category_name`, `storage_type_id`, `quality_check_required`, `description`, `display_order`, `is_active`, `created_at`, `updated_at`) VALUES");
$categories = [
    [1, 'CAT-CEM', 'Cement & Binding Materials', 1, 1, 'OPC 53, PPC, Microfine, White Cement & Fly Ash'],
    [2, 'CAT-STL', 'Reinforcement & Structural Steel', 1, 1, 'TMT Fe550D Rebars, MS Plates, Channels & Beams'],
    [3, 'CAT-AGG', 'Aggregates, Sand & Quarry Products', 2, 1, 'M-Sand, P-Sand, 20mm/40mm/10mm Blue Metal, GSB Gravel'],
    [4, 'CAT-MSN', 'Bricks, AAC Blocks & Solid Masonry', 2, 1, 'Red Clay Wirecut Bricks, AAC Lightweight Blocks, Solid Blocks'],
    [5, 'CAT-RMC', 'Ready Mix Concrete & Admixtures', 1, 1, 'Design Mix M20-M50 Concrete, Superplasticizers, Retarders'],
    [6, 'CAT-ELE', 'Electrical Cables, Conduits & Switchgear', 1, 1, 'FRLS Copper Wire, Armoured Cables, PVC Conduits, MCB/RCCB'],
    [7, 'CAT-PLB', 'Plumbing Pipes, Valves & Sanitaryware', 1, 1, 'CPVC, UPVC, SWR Pipes, Brass Ball Valves, Water Closets'],
    [8, 'CAT-HVAC', 'HVAC, Firefighting & Ducting', 1, 1, 'GI Ducts, VRV Indoor/Outdoor Units, Fire Sprinklers, Hydrants'],
    [9, 'CAT-PNT', 'Paints, Primers & Surface Coatings', 1, 1, 'Exterior Acrylic Emulsion, Royale Interior Paint, Epoxy Primer'],
    [10, 'CAT-FLR', 'Flooring Tiles, Granite & Italian Marble', 1, 1, 'Vitrified Double Charge Tiles, Black Galaxy Granite, Marble'],
    [11, 'CAT-GLZ', 'Doors, Windows, Aluminium & Glass', 1, 1, 'Domal Aluminium Section, 12mm Toughened Glass, Flush Doors'],
    [12, 'CAT-WTR', 'Waterproofing & Chemical Sealants', 1, 1, '2K Acrylic Polymer Waterproofing, PU Sealants, Non-Shrink Grout'],
    [13, 'CAT-WOD', 'Plywood, Shuttering & False Ceiling', 1, 1, '18mm Film Faced Shuttering Ply, Marine Ply, Gypsum Plaster Board'],
    [14, 'CAT-SAF', 'Safety PPE & Site Equipment Supplies', 1, 0, 'Safety Helmets, Steel Toe Shoes, Reflective Vests, Safety Harness']
];
$catRows = [];
foreach ($categories as $idx => $c) {
    $catRows[] = "({$c[0]}, 1, '{$c[1]}', '{$c[2]}', {$c[3]}, {$c[4]}, '{$c[5]}', " . ($idx + 1) . ", 1, '2023-01-01', NOW())";
}
writeLine($fp, implode(",\n", $catRows));
writeLine($fp, "ON DUPLICATE KEY UPDATE `category_name` = VALUES(`category_name`);\n");

// ----------------------------------------------------------------------------
// 9. 200 DETAILED MATERIALS INVENTORY MASTER
// ----------------------------------------------------------------------------
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 9. 200 DETAILED CONSTRUCTION MATERIALS");
writeLine($fp, "-- ----------------------------------------------------------------------------");

$matDefs = [
    // 1. Cement & Binding Materials (1-15)
    [1, 'Ramco Cement', '50kg HDPE laminated bag, IS 12269 certified', 'Ramco', '25232910', 18.0, 390.00, 500, 200, 1],
    [1, 'UltraTech Cement', '50kg OPC 53 grade cement bag', 'UltraTech', '25232910', 18.0, 395.00, 500, 200, 1],
    [1, 'Chettinad Cement', '50kg PPC blended portland cement', 'Chettinad', '25232930', 18.0, 375.00, 600, 250, 1],
    [1, 'Dalmia Cement', '50kg slag blended high strength cement', 'Dalmia', '25232940', 18.0, 385.00, 400, 150, 1],
    [1, 'White Cement', 'Pure white architectural cement 50kg', 'Birla White', '25232100', 18.0, 1150.00, 50, 20, 1],
    [1, 'Wall Putty', 'White cement based polymer wall putty 40kg', 'Birla White', '32141000', 18.0, 880.00, 100, 40, 1],
    [1, 'Tile Adhesive', 'Cementitious adhesive powder for vitrified tiles 20kg', 'UltraTech', '35069190', 18.0, 420.00, 150, 60, 1],
    [1, 'Tile Grout', 'Stain resistant epoxy tile joint filler 5kg', 'Roff', '32141000', 18.0, 1250.00, 40, 15, 10],
    [1, 'Non-Shrink Grout', 'High-strength free-flow cement grout 25kg', 'Fosroc GP2', '38245090', 18.0, 750.00, 80, 30, 1],
    [1, 'Waterproofing Powder', 'Capillary pore blocking crystalline compound 20kg', 'Dr. Fixit', '38244090', 18.0, 1450.00, 40, 15, 1],
    [1, 'Fly Ash', 'High fineness pozzolanic flyash powder', 'Mettur Thermal', '26219000', 5.0, 1400.00, 30, 10, 2],
    [1, 'Slag Powder', 'Ground granulated blast furnace slag GGBS', 'JSW Steel', '26180000', 5.0, 3800.00, 25, 10, 2],
    [1, 'Bonding Agent', 'SBR polymer bonding agent for concrete 20L', 'Dr. Fixit URP', '38244090', 18.0, 3850.00, 20, 8, 8],
    [1, 'Latex Polymer', 'Synthetic rubber emulsion for bonding slurries 20L', 'SikaLatex', '38244090', 18.0, 4100.00, 15, 6, 8],
    [1, 'Silica Fume', 'Micro silica for high durability concrete 25kg', 'Elkem', '28112200', 18.0, 1850.00, 40, 15, 1],

    // 2. Reinforcement & Structural Steel (16-35)
    [2, 'TMT Steel 8mm', 'Fe550D primary thermo-mechanically treated rebar', 'Tata Tiscon', '72142090', 18.0, 68500.00, 10, 3, 2],
    [2, 'TMT Steel 10mm', 'Fe550D high ductility reinforcement steel bar', 'Tata Tiscon', '72142090', 18.0, 67800.00, 15, 5, 2],
    [2, 'TMT Steel 12mm', 'Fe550D structural steel rebar', 'Tata Tiscon', '72142090', 18.0, 66500.00, 20, 6, 2],
    [2, 'TMT Steel 16mm', 'Fe550D heavy column & beam rebar', 'Tata Tiscon', '72142090', 18.0, 66500.00, 25, 8, 2],
    [2, 'TMT Steel 20mm', 'Fe550D heavy foundation rebar', 'Tata Tiscon', '72142090', 18.0, 66500.00, 25, 8, 2],
    [2, 'TMT Steel 25mm', 'Fe550D column main load bearing bar', 'Tata Tiscon', '72142090', 18.0, 67200.00, 20, 6, 2],
    [2, 'TMT Steel 32mm', 'Fe550D heavy foundation pile cap steel', 'Tata Tiscon', '72142090', 18.0, 68000.00, 15, 5, 2],
    [2, 'Tata Steel 12mm', 'Tata Tiscon 550D high strength steel', 'Tata Tiscon', '72142090', 18.0, 68000.00, 20, 6, 2],
    [2, 'JSW Steel 16mm', 'JSW Neosteel 550D virgin iron ore rebar', 'JSW Neosteel', '72142090', 18.0, 65500.00, 20, 6, 2],
    [2, 'SAIL Steel 10mm', 'SAIL earthquake resistant steel rebar', 'SAIL', '72142090', 18.0, 66000.00, 15, 5, 2],
    [2, 'Binding Wire', 'GI 18 gauge soft annealed rebar tying wire', 'Tata Agrico', '72172010', 18.0, 85.00, 500, 150, 9],
    [2, 'MS Beam 200', 'Hot rolled I-beam ISMB 200 section', 'SAIL / Jindal', '72163200', 18.0, 71500.00, 10, 3, 2],
    [2, 'MS Beam 300', 'Hot rolled I-beam ISMB 300 section', 'SAIL / Jindal', '72163200', 18.0, 72500.00, 12, 4, 2],
    [2, 'MS Channel 150', 'Hot rolled C-channel ISMC 150 section', 'SAIL / Jindal', '72163100', 18.0, 70500.00, 8, 2, 2],
    [2, 'MS Angle 75x75', 'Structural steel angle 75x75x6mm', 'SAIL / Jindal', '72162100', 18.0, 69500.00, 8, 2, 2],
    [2, 'MS Angle 50x50', 'Structural framing angle 50x50x5mm', 'SAIL / Jindal', '72162100', 18.0, 69500.00, 6, 2, 2],
    [2, 'MS Chequered Plate', 'Anti-skid vehicle ramp floor plate 6mm', 'Tata Steel', '72085110', 18.0, 74000.00, 5, 2, 2],
    [2, 'MS Steel Plate 12mm', 'Base plate structural steel plate', 'Jindal Steel', '72085190', 18.0, 73000.00, 6, 2, 2],
    [2, 'Roof Decking Sheet', 'Galvanized trapezoidal floor deck sheet 0.8mm', 'Tata Bluescope', '73089090', 18.0, 480.00, 300, 100, 4],
    [2, 'Galvanized Purlin', 'Cold formed 200mm high tensile C-purlin', 'Everest', '73089090', 18.0, 340.00, 250, 80, 6],

    // 3. Aggregates, Sand & Quarry Products (36-50)
    [3, 'M-Sand', 'Manufactured sand Zone II for RCC concrete', 'Kongu Blue Metal', '25059000', 5.0, 1650.00, 50, 15, 12],
    [3, 'P-Sand', 'Plastering fine sand 0-2.36mm for wall plaster', 'Amaravathi Aggregates', '25059000', 5.0, 1850.00, 40, 12, 12],
    [3, 'Blue Metal 20mm', 'Graded 20mm granite aggregate for RCC slabs', 'Karur Quarry Mills', '25171010', 5.0, 1450.00, 60, 20, 12],
    [3, 'Blue Metal 40mm', 'Graded 40mm coarse aggregate for foundation PCC', 'Karur Quarry Mills', '25171010', 5.0, 1350.00, 40, 15, 12],
    [3, 'Blue Metal 10mm', 'Fine 10mm granite chips for lintels & precast', 'Kongu Blue Metal', '25171010', 5.0, 1500.00, 30, 10, 12],
    [3, 'Quarry Dust', 'Crusher dust for solid block making & bedding', 'Amaravathi Aggregates', '25171020', 5.0, 950.00, 40, 15, 12],
    [3, 'GSB Gravel', 'Granular sub-base stone & gravel road mix', 'Karur Infrastructure', '25171090', 5.0, 850.00, 60, 20, 12],
    [3, 'WMM Material', 'Wet mix macadam plant mixed road base course', 'Kongu Blue Metal', '25171090', 5.0, 1150.00, 50, 15, 12],
    [3, 'Red Filling Soil', 'Clean red earth for plinth backfilling', 'Local Quarry', '25051000', 5.0, 650.00, 80, 30, 12],
    [3, 'Cover Block 20mm', 'Precast M30 concrete cover blocks for slabs', 'Kongu Precast', '68109990', 18.0, 1.80, 5000, 1500, 7],
    [3, 'Cover Block 40mm', 'Precast concrete spacer blocks for columns', 'Kongu Precast', '68109990', 18.0, 3.50, 3000, 1000, 7],
    [3, 'PVC Chamfer Strip', 'Triangular plastic bevel bead strip 25mm', 'Supreme', '39259090', 18.0, 28.00, 300, 100, 6],
    [3, 'Lightweight Aggregate', 'Expanded clay aggregate for light screed', 'LECA India', '68069000', 18.0, 3200.00, 20, 5, 3],
    [3, 'Bentonite Powder', 'Piling drilling bentonite mud powder 50kg', 'Ashapura', '25081090', 18.0, 450.00, 50, 15, 1],
    [3, 'Filter Gravel', 'Natural rounded pea gravel for subsoil drainage', 'Amaravathi Aggregates', '25171010', 5.0, 1600.00, 25, 10, 12],

    // 4. Bricks, AAC Blocks & Solid Masonry (51-65)
    [4, 'Red Brick', 'Standard kiln-burnt red clay brick 9x4x3', 'Kongu Brick Works', '69010010', 12.0, 11.50, 25000, 8000, 7],
    [4, 'Wirecut Red Brick', 'First class wirecut red clay brick', 'Kongu Brick Works', '69010010', 12.0, 14.00, 15000, 5000, 7],
    [4, 'AAC Block 8 Inch', 'Lightweight thermal AAC block 600x200x200', 'Aerocon', '68101190', 18.0, 125.00, 2000, 600, 7],
    [4, 'AAC Block 6 Inch', 'Lightweight AAC block 600x200x150', 'Aerocon', '68101190', 18.0, 95.00, 3000, 800, 7],
    [4, 'AAC Block 4 Inch', 'Lightweight AAC partition block 600x200x100', 'Aerocon', '68101190', 18.0, 68.00, 4000, 1000, 7],
    [4, 'Solid Block 8 Inch', 'Solid concrete block 400x200x200', 'Kongu Precast', '68101110', 18.0, 48.00, 3500, 1000, 7],
    [4, 'Solid Block 4 Inch', 'Solid concrete block 400x200x100', 'Kongu Precast', '68101110', 18.0, 28.00, 4000, 1200, 7],
    [4, 'Hollow Block', 'Hollow concrete acoustic block 400x200x200', 'Kongu Precast', '68101120', 18.0, 42.00, 2500, 800, 7],
    [4, 'Block Jointing Mortar', 'Ready-mix adhesive mortar for AAC blocks 40kg', 'UltraTech Fixblock', '38245090', 18.0, 440.00, 300, 100, 1],
    [4, 'Fly Ash Brick', 'Machine pressed cement fly ash brick', 'Karur Eco Bricks', '68101190', 12.0, 6.80, 15000, 5000, 7],
    [4, 'Precast U-Drain', 'Storm water concrete drain channel 300x300mm', 'Kongu Precast', '68109990', 18.0, 850.00, 150, 40, 6],
    [4, 'Compound Wall Panel', 'Precast prestressed concrete wall panel 7ft', 'Kongu Precast', '68109990', 18.0, 1100.00, 80, 25, 7],
    [4, 'Paver Block 80mm', 'Heavy duty zig-zag road paver block M40', 'UltraTech Pavers', '68101990', 18.0, 48.00, 400, 150, 4],
    [4, 'Paver Block 60mm', 'Footpath hexagonal decorative paver block', 'UltraTech Pavers', '68101990', 18.0, 38.00, 500, 150, 4],
    [4, 'Kerb Stone', 'Precast roadside kerb stone 450x300x150mm', 'Kongu Precast', '68109990', 18.0, 240.00, 200, 60, 7],

    // 5. Ready Mix Concrete & Admixtures (66-80)
    [5, 'RMC M20 Concrete', 'Design mix 20 N/mm2 ready mix concrete', 'UltraTech RMC', '38245010', 18.0, 4450.00, 20, 5, 3],
    [5, 'RMC M25 Concrete', 'Standard slab RCC ready mix concrete 25 N/mm2', 'UltraTech RMC', '38245010', 18.0, 4750.00, 30, 10, 3],
    [5, 'RMC M30 Concrete', 'High strength framed concrete 30 N/mm2', 'UltraTech RMC', '38245010', 18.0, 5100.00, 40, 15, 3],
    [5, 'RMC M35 Concrete', 'High performance concrete 35 N/mm2', 'UltraTech RMC', '38245010', 18.0, 5450.00, 25, 8, 3],
    [5, 'RMC M40 Concrete', 'Heavy loaded column ready mix concrete 40 N/mm2', 'UltraTech RMC', '38245010', 18.0, 5850.00, 20, 6, 3],
    [5, 'Self Compacting Concrete', 'Free flowing zero vibration concrete M35', 'UltraTech RMC', '38245010', 18.0, 6200.00, 15, 5, 3],
    [5, 'Superplasticizer Chemical', 'PCE based high range water reducing admixture 200L', 'Fosroc Auramix', '38244090', 18.0, 24000.00, 4, 1, 10],
    [5, 'Concrete Admixture', 'Viscosity modifying high early strength chemical', 'Sika ViscoCrete', '38244090', 18.0, 26500.00, 3, 1, 10],
    [5, 'Concrete Retarder', 'Setting retarder admixture for hot weather 200L', 'Sika Plastiment', '38244090', 18.0, 19500.00, 3, 1, 10],
    [5, 'Waterproofing Liquid', 'Integral liquid waterproofing for concrete 20L', 'Fosroc Conplast', '38244090', 18.0, 2150.00, 20, 5, 8],
    [5, 'Pidiproof LW+ Liquid', 'Integral cement waterproofing compound 20L', 'Dr. Fixit', '38244090', 18.0, 2450.00, 18, 6, 8],
    [5, 'Recron Fibres', 'Micro synthetic crack prevention fibres 6mm (900g)', 'Reliance Recron', '55034000', 18.0, 280.00, 100, 30, 10],
    [5, 'Steel Fibres', 'Cold drawn hooked steel fibres for floor 20kg', 'Bekaert Dramix', '73269099', 18.0, 2400.00, 30, 10, 1],
    [5, 'Floor Hardener', 'Non-metallic mineral floor hardener 25kg', 'Sikafloor Chapdur', '38245090', 18.0, 520.00, 120, 40, 1],
    [5, 'Shuttering Oil', 'Formwork release mould oil 200L', 'Fosroc Formcoat', '27101990', 18.0, 22000.00, 3, 1, 10],

    // 6. Electrical Cables, Conduits & Switchgear (81-100)
    [6, 'Copper Wire 1.5 sqmm', 'FRLS single core copper wire (90m coil)', 'Polycab', '85444999', 18.0, 1480.00, 60, 20, 10],
    [6, 'Copper Wire 2.5 sqmm', 'FRLS single core power copper wire (90m coil)', 'Polycab', '85444999', 18.0, 2350.00, 50, 18, 10],
    [6, 'Copper Wire 4.0 sqmm', 'FRLS dedicated AC copper wire (90m coil)', 'Polycab', '85444999', 18.0, 3650.00, 40, 15, 10],
    [6, 'Copper Wire 6.0 sqmm', 'FRLS sub-main copper conductor (90m coil)', 'Polycab', '85444999', 18.0, 5450.00, 30, 10, 10],
    [6, 'Armoured Cable 16 sqmm', '4-Core XLPE copper underground cable per metre', 'Finolex', '85444999', 18.0, 680.00, 300, 100, 6],
    [6, 'Armoured Cable 50 sqmm', '4-Core XLPE aluminium feeder cable per metre', 'Finolex', '85444999', 18.0, 420.00, 400, 120, 6],
    [6, 'PVC Conduit Pipe 20mm', 'Rigid electrical conduit pipe 3m', 'VIP Conduits', '39172310', 18.0, 65.00, 500, 150, 7],
    [6, 'PVC Conduit Pipe 25mm', 'Heavy slab electrical conduit pipe 3m', 'VIP Conduits', '39172310', 18.0, 85.00, 400, 120, 7],
    [6, 'MCB 16A Single Pole', 'Single pole miniature circuit breaker', 'Schneider Electric', '85362030', 18.0, 210.00, 150, 40, 7],
    [6, 'MCB 32A Triple Pole', 'Three pole 3-phase machinery MCB', 'Schneider Electric', '85362030', 18.0, 950.00, 40, 15, 7],
    [6, 'RCCB 40A Earth Leakage', '4-Pole residual current shock safety breaker', 'Schneider Electric', '85362030', 18.0, 2650.00, 25, 8, 7],
    [6, 'Modular Switch 6A', 'White 1-way modular lighting switch', 'Legrand Arteor', '85365020', 18.0, 95.00, 300, 100, 7],
    [6, 'Modular Socket 16A', 'Safety shuttered 3-pin power socket', 'Legrand Arteor', '85366910', 18.0, 195.00, 200, 60, 7],
    [6, 'Metal GI Box 8 Module', 'Concealed metal flush box 18SWG', 'Legrand', '85381010', 18.0, 110.00, 180, 50, 7],
    [6, 'LED Downlight 15W', 'Ceiling recessed square LED light fitting', 'Havells', '94051090', 18.0, 450.00, 120, 40, 7],
    [6, 'LED Panel Light 36W', 'False ceiling 2x2 modular LED office panel', 'Philips', '94051090', 18.0, 1650.00, 80, 25, 7],
    [6, 'Earthing Rod 3m', 'Copper bonded ground electrode rod 3m', 'TruePower', '85359090', 18.0, 2800.00, 20, 6, 10],
    [6, 'Earthing Chemical Powder', 'Conductive earth enhancing chemical 25kg', 'TruePower', '38249900', 18.0, 750.00, 30, 10, 1],
    [6, 'GI Cable Tray', 'Galvanized perforated cable tray 150x50mm', 'Profab', '73269099', 18.0, 680.00, 80, 20, 7],
    [6, 'Cat-6 LAN Cable', 'UTP solid copper networking data cable (305m box)', 'D-Link', '85444999', 18.0, 8900.00, 10, 3, 10],

    // 7. Plumbing Pipes, Valves & Sanitaryware (101-120)
    [7, 'CPVC Pipe 1 Inch', 'Hot & cold water pipe SDR 11 (3m)', 'Astral', '39172390', 18.0, 385.00, 150, 50, 7],
    [7, 'CPVC Pipe 1.5 Inch', 'Main riser high pressure CPVC pipe (3m)', 'Astral', '39172390', 18.0, 720.00, 100, 30, 7],
    [7, 'UPVC Pipe 2 Inch', 'Cold drinking water supply pipe Class 3 (6m)', 'Astral', '39172390', 18.0, 850.00, 80, 25, 7],
    [7, 'SWR Drain Pipe 110mm', 'Soil waste drain pipe with ringfit (3m)', 'Astral', '39172390', 18.0, 1150.00, 80, 25, 7],
    [7, 'SWR Drain Pipe 75mm', 'Rainwater and wastewater drain pipe (3m)', 'Supreme', '39172390', 18.0, 420.00, 120, 40, 7],
    [7, 'Brass Ball Valve 1 Inch', 'Full bore brass water isolation valve', 'Zoloto', '84818030', 18.0, 850.00, 50, 15, 7],
    [7, 'Check Valve 2 Inch', 'Dual plate non-return check valve for pump', 'Zoloto', '84813000', 18.0, 3400.00, 15, 5, 7],
    [7, 'Butterfly Valve 3 Inch', 'Overhead water tank isolation valve', 'L&T Audco', '84818030', 18.0, 4200.00, 12, 4, 7],
    [7, 'Western Toilet Closet (WC)', 'Wall hung rimless ceramic toilet set', 'Cera', '69101000', 18.0, 6800.00, 40, 12, 10],
    [7, 'Concealed Flush Tank', 'In-wall dual flush cistern with push plate', 'Jaquar', '39229000', 18.0, 4200.00, 40, 12, 10],
    [7, 'Basin Mixer Tap', 'Chrome single lever hot & cold wash faucet', 'Jaquar', '84818020', 18.0, 2850.00, 50, 15, 7],
    [7, 'Bath Shower Diverter', 'Concealed ceramic disc bath shower body', 'Jaquar', '84818020', 18.0, 3650.00, 40, 12, 10],
    [7, 'Wash Basin', 'Under-counter white ceramic wash basin', 'Hindware', '69101000', 18.0, 2100.00, 45, 15, 7],
    [7, 'Auto Sensor Urinal', 'Infrared automatic sensor gents urinal', 'Cera', '69101000', 18.0, 7800.00, 25, 8, 10],
    [7, 'Water Tank 2000L', '3-Layer UV stabilized plastic overhead tank', 'Sintex', '39251000', 18.0, 14500.00, 10, 3, 7],
    [7, 'Water Motor Pump 3HP', 'Openwell submersible high head pump', 'CRI Pumps', '84137010', 18.0, 21000.00, 4, 1, 7],
    [7, 'Booster Pump System', 'Variable speed constant pressure pump set', 'Grundfos', '84137090', 18.0, 185000.00, 2, 1, 10],
    [7, 'SS Floor Drain Jali', 'Stainless steel 304 cockroach trap drain jali', 'Chilly', '73249000', 18.0, 380.00, 100, 30, 7],
    [7, 'Kitchen Sink SS', 'Double bowl stainless steel 304 sink', 'Nirali', '73241000', 18.0, 8500.00, 15, 5, 7],
    [7, 'Manhole Chamber Cover', 'Heavy duty cast iron 600mm round cover', 'NECO', '73251000', 18.0, 4800.00, 20, 6, 10],

    // 8. HVAC, Firefighting & Ducting (121-135)
    [8, 'Fire Sprinkler Pipe 50mm', 'Heavy class MS black pipe for fire network (6m)', 'Tata Steel', '73063090', 18.0, 1650.00, 100, 30, 7],
    [8, 'Fire Hydrant Pipe 100mm', 'Red epoxy coated heavy fire header pipe (6m)', 'Tata Steel', '73063090', 18.0, 3850.00, 80, 25, 7],
    [8, 'Fire Sprinkler Head', 'Chrome pendent automatic glass bulb sprinkler 68C', 'Tyco', '84249000', 18.0, 260.00, 400, 100, 7],
    [8, 'Fire Hydrant Valve', 'Gunmetal 63mm landing valve for fire hose', 'Newage', '84818090', 18.0, 3800.00, 30, 10, 7],
    [8, 'Fire Hose Pipe 30m', 'Canvas rubber lined 63mm fire hose with nozzle', 'Newage', '59090090', 18.0, 4500.00, 25, 8, 10],
    [8, 'Fire Extinguisher ABC 6kg', 'Multi-purpose dry powder fire extinguisher', 'Ceasefire', '84241000', 18.0, 2850.00, 40, 12, 7],
    [8, 'Clean Agent Extinguisher', 'Server room clean agent gas extinguisher 4kg', 'Ceasefire', '84241000', 18.0, 8500.00, 15, 5, 7],
    [8, 'GI Duct Sheet 22G', 'Galvanized zinc coated sheet for AC air duct', 'Jindal Steel', '72104900', 18.0, 88.00, 1500, 400, 9],
    [8, 'Duct Foam Insulation', 'Nitrile rubber thermal sheet insulation 19mm', 'Armaflex', '40169990', 18.0, 480.00, 200, 60, 4],
    [8, 'Linear Air Diffuser', 'White aluminium ceiling AC supply air grille', 'Airflow', '76169990', 18.0, 1150.00, 60, 20, 7],
    [8, 'Cassette AC 2.0 TR', 'Ceiling 4-way cassette inverter indoor AC', 'Voltas', '84151010', 28.0, 58000.00, 12, 4, 10],
    [8, 'VRV Outdoor AC Unit', 'High efficiency multi-split VRV outdoor 16 HP', 'Daikin', '84158210', 28.0, 345000.00, 4, 1, 10],
    [8, 'Air Handling Unit (AHU)', 'Double skin AHU 5000 CFM with VFD', 'Zeco', '84158290', 18.0, 185000.00, 2, 1, 10],
    [8, 'HEPA Filter', 'Hospital OT cleanroom HEPA filter H14', 'AAF', '84213920', 18.0, 6800.00, 20, 6, 7],
    [8, 'Copper Gas Pipe 15mm', 'Seamless oxygen cleaned medical copper pipe', 'Mexflow', '74111000', 18.0, 920.00, 80, 25, 7],

    // 9. Paints, Primers & Surface Coatings (136-150)
    [9, 'Exterior Apex Paint', 'Weatherproof exterior acrylic emulsion 20L', 'Asian Paints', '32091090', 18.0, 6400.00, 35, 10, 8],
    [9, 'Interior Royale Paint', 'Luxury washable interior matt wall paint 20L', 'Asian Paints', '32091090', 18.0, 7800.00, 40, 12, 8],
    [9, 'Exterior Wall Primer', 'Alkali resistant masonry sealing primer 20L', 'Asian Paints', '32099090', 18.0, 2250.00, 30, 10, 8],
    [9, 'Interior Wall Primer', 'Water based acrylic plaster primer 20L', 'Asian Paints', '32099090', 18.0, 1850.00, 35, 10, 8],
    [9, 'Enamel Paint White', 'High gloss synthetic enamel paint 20L', 'Berger Paints', '32089029', 18.0, 4200.00, 20, 6, 8],
    [9, 'Red Oxide Primer', 'Anti-corrosive metal primer for steel 20L', 'Berger Paints', '32089019', 18.0, 2800.00, 25, 8, 8],
    [9, 'Epoxy Floor Paint', '2-Component industrial glossy epoxy floor coat 20kg', 'Sikafloor', '32089090', 18.0, 9200.00, 20, 6, 10],
    [9, 'Epoxy Floor Primer', 'Substrate penetrating epoxy primer 20kg', 'Sikafloor', '32089090', 18.0, 7800.00, 18, 6, 10],
    [9, 'PU Wood Polish', 'Clear polyurethane scratch resistant wood polish 20L', 'MRF', '32089090', 18.0, 6800.00, 15, 5, 8],
    [9, 'Heat Reflective Roof Paint', 'Solar heat reflective thermal roof coating 20L', 'Dr. Fixit', '32091090', 18.0, 4850.00, 20, 6, 8],
    [9, 'Silicone Sealant', 'Mildew resistant white gap filling sealant 310ml', 'McCoy', '32141000', 18.0, 195.00, 150, 40, 7],
    [9, 'Damp Proof Paint', 'Crystalline inner dampness block coat 15kg', 'Asian Paints', '38244090', 18.0, 2600.00, 25, 8, 10],
    [9, 'Wall Texture Paint', 'Exterior stone effect textured wall coat 25kg', 'Spectrum', '32091090', 18.0, 1450.00, 40, 15, 1],
    [9, 'PU Topcoat Paint', 'Chemical resistant external protective paint 20L', 'Asian PPG', '32089090', 18.0, 8500.00, 12, 4, 8],
    [9, 'Road Marking Paint', 'Retro-reflective yellow thermoplastic compound 25kg', 'Berger', '32089090', 18.0, 2100.00, 50, 15, 1],

    // 10. Flooring Tiles, Granite & Italian Marble (151-165)
    [10, 'Vitrified Floor Tile 2x4', 'Polished glazed vitrified floor tiles 600x1200mm', 'Kajaria', '69072100', 18.0, 82.00, 1500, 400, 5],
    [10, 'Vitrified Floor Tile 2x2', 'Double charge heavy duty vitrified tiles 600x600mm', 'Somany', '69072100', 18.0, 58.00, 2000, 600, 5],
    [10, 'Bathroom Anti-Skid Tile', 'Matte anti-slip bathroom floor tiles 300x300mm', 'Kajaria', '69072300', 18.0, 38.00, 1200, 350, 5],
    [10, 'Ceramic Wall Tile', 'Digital glazed decorative wall tiles 300x600mm', 'Somany', '69072200', 18.0, 42.00, 1500, 400, 5],
    [10, 'Black Galaxy Granite', 'Premium polished South Indian black granite slab', 'Karur Stone', '68022310', 18.0, 185.00, 800, 200, 5],
    [10, 'Tan Brown Granite', 'Polished granite slab for staircase & counter', 'Karur Stone', '68022310', 18.0, 145.00, 600, 150, 5],
    [10, 'Kashmir White Granite', 'Flamed non-slip exterior white granite slab', 'Madurai Granite', '68022390', 18.0, 125.00, 500, 120, 5],
    [10, 'Italian Statuario Marble', 'Imported luxury white grey-veined marble slab', 'Bhandari', '68022110', 18.0, 680.00, 400, 100, 5],
    [10, 'Italian Botticino Marble', 'Imported warm beige luxury marble slab', 'Bhandari', '68022110', 18.0, 420.00, 500, 120, 5],
    [10, 'Kotah Stone Slab', 'Natural honed non-slip blue limestone slab', 'Kotah Stone', '68029900', 18.0, 48.00, 1000, 300, 5],
    [10, 'Industrial Paver Block', 'Heavy load M50 industrial paver 100mm', 'UltraTech', '68101990', 18.0, 62.00, 300, 100, 4],
    [10, 'WPC Decking Plank', 'Wood composite outdoor poolside deck board', 'Everwood', '39259090', 18.0, 340.00, 150, 40, 5],
    [10, 'Vinyl Floor Mat 2mm', 'Anti-bacterial seamless vinyl roll for hospital', 'Armstrong', '39181000', 18.0, 125.00, 600, 150, 5],
    [10, 'Trimix VDF Flooring', 'Vacuum dewatered concrete floor hardener system', 'Trimix', '68109990', 18.0, 65.00, 1000, 300, 5],
    [10, 'Tactile Guide Tile', 'Yellow braille blister hazard tactile tile', 'Tactile India', '39259090', 18.0, 85.00, 200, 60, 7],

    // 11. Doors, Windows, Aluminium & Glass (166-180)
    [11, 'Toughened Glass 12mm', 'Clear tempered safety architectural glass', 'Saint-Gobain', '70071900', 18.0, 165.00, 800, 200, 5],
    [11, 'DGU Glass Facade Panel', 'Double glazed insulated glass unit Low-E', 'Saint-Gobain', '70080000', 18.0, 380.00, 500, 120, 5],
    [11, 'Aluminium Window Section', 'Anodized 25-micron aluminium framing section', 'Jindal Aluminium', '76042100', 18.0, 340.00, 600, 150, 9],
    [11, 'Aluminium Sliding Window', '2-Track 2-panel sliding window assembly set', 'Jindal / Domal', '76101000', 18.0, 420.00, 120, 30, 5],
    [11, 'Spider Glass Fitting SS', '4-Arm stainless steel 316 spider glass fitting', 'Dorma / Ozone', '73269099', 18.0, 2400.00, 60, 20, 10],
    [11, 'Floor Spring Door Closer', 'Universal concealed hydraulic floor closer', 'Dorma', '83024110', 18.0, 6800.00, 25, 8, 10],
    [11, 'Glass Door Handle SS', 'Satin stainless steel cylindrical door handle', 'Ozone', '83024110', 18.0, 1450.00, 50, 15, 10],
    [11, 'Teak Wood Door Frame', 'Seasoned first class teak wood frame (7ft)', 'Kongu Wood', '44072910', 18.0, 12500.00, 20, 5, 7],
    [11, 'Flush Door Shutter', 'Solid core flush door shutter 35mm with veneer', 'Greenlam', '44182090', 18.0, 4800.00, 40, 12, 7],
    [11, 'Godrej Door Lock', '6-Lever brass mortise door lock set', 'Godrej', '83014010', 18.0, 2150.00, 50, 15, 10],
    [11, 'UPVC Window Set', '2-Leaf casement window with insect mesh', 'Fenesta', '39252000', 18.0, 550.00, 100, 25, 5],
    [11, 'SS Railing Handrail Pipe', 'Mirror polished stainless steel 304 pipe 50mm', 'Salem Steel', '73064000', 18.0, 2400.00, 40, 12, 7],
    [11, 'Rolling Shutter Motorized', 'Galvanized steel motorized rolling shutter 4x3.5m', 'Gandhi Automations', '73089090', 18.0, 48000.00, 6, 2, 10],
    [11, 'Automatic Glass Sliding Door', 'Sensor activated frameless sliding glass door', 'Geze', '84798999', 18.0, 115000.00, 3, 1, 10],
    [11, 'Fire Rated Steel Door', '2-Hour fire rated steel acoustic door with bar', 'Shakti Hormann', '73083000', 18.0, 22500.00, 15, 4, 10],

    // 12. Waterproofing & Chemical Sealants (181-190)
    [12, '2K Waterproofing Coat', '2-Component flexible acrylic waterproofing 12kg', 'Dr. Fixit', '38244090', 18.0, 2650.00, 30, 10, 10],
    [12, 'Brushbond Slurry Coat', 'Polymer modified cement waterproofing slurry 25kg', 'Fosroc', '38244090', 18.0, 1850.00, 40, 12, 1],
    [12, 'PU Expansion Sealant', 'Polyurethane expansion joint sealant sausage 600ml', 'Sikaflex', '32141000', 18.0, 580.00, 120, 35, 7],
    [12, 'APP Waterproof Membrane', 'Torch applied 4mm mineral roof membrane roll', 'STP Ltd', '68071010', 18.0, 2450.00, 50, 15, 10],
    [12, 'PVC Waterstop Strip', 'Basement ribbed construction waterstop 200mm (15m)', 'Supreme', '39259090', 18.0, 3200.00, 25, 8, 10],
    [12, 'Micro Concrete Renderoc', 'Shrinkage compensated flowable micro-concrete 25kg', 'Fosroc', '38245090', 18.0, 620.00, 60, 20, 1],
    [12, 'Carbon Fibre Wrap', 'High strength structural column retrofitting wrap', 'SikaWrap', '68151090', 18.0, 42000.00, 4, 1, 10],
    [12, 'Epoxy Injection Crack Grout', 'Low viscosity crack healing injection resin 1L', 'Fosroc', '39073010', 18.0, 1650.00, 30, 8, 8],
    [12, 'PU Expanding Foam', 'Aerosol gap insulation expanding foam 750ml', 'Sika Boom', '32149000', 18.0, 420.00, 80, 25, 7],
    [12, 'Crystalline Waterproof Powder', 'Catalytic capillary waterproofing admixture 20kg', 'Xypex', '38244090', 18.0, 5800.00, 20, 5, 1],

    // 13. Plywood, Shuttering & False Ceiling (191-196)
    [13, 'Shuttering Plywood 18mm', 'Film faced high density shuttering ply (8x4 Ft)', 'Greenply', '44123990', 18.0, 2150.00, 200, 60, 7],
    [13, 'Marine Plywood 12mm', 'BWP grade 710 calibrated marine plywood (8x4 Ft)', 'CenturyPly', '44123190', 18.0, 1650.00, 100, 30, 7],
    [13, 'Gypsum Board 12.5mm', 'Moisture resistant false ceiling gypsum board (6x4 Ft)', 'Saint-Gobain', '68091100', 18.0, 395.00, 300, 80, 7],
    [13, 'Mineral Fibre Ceiling Tile', 'Acoustic fine fissured ceiling board (2x2 Ft)', 'Armstrong', '68069000', 18.0, 68.00, 800, 200, 7],
    [13, 'False Ceiling GI Channel', 'Suspended ceiling galvanized main channel 3.66m', 'Gyproc', '73089090', 18.0, 165.00, 250, 70, 7],
    [13, 'Calcium Silicate Ceiling Tile', 'Non-combustible cleanroom ceiling tile 2x2 Ft', 'Aerolite', '68099000', 18.0, 95.00, 400, 100, 7],

    // 14. Safety PPE & Site Infrastructure (197-200)
    [14, 'Safety Helmet Yellow', 'High impact industrial safety helmet', 'Karam', '65061090', 18.0, 240.00, 100, 30, 7],
    [14, 'Steel Toe Safety Shoes', '200J steel toe impact protective work leather shoes', 'Allen Cooper', '64034000', 18.0, 950.00, 80, 25, 10],
    [14, 'Full Body Safety Harness', 'Fall arrest safety harness with double lanyard hook', 'Karam', '63079090', 18.0, 1650.00, 50, 15, 10],
    [14, 'Caution Barricade Tape', 'High visibility red/white warning tape 500m', 'SureSafety', '39191000', 18.0, 320.00, 60, 20, 10]
];

$matRows = [];
foreach ($matDefs as $mIdx => $m) {
    $mId = $mIdx + 1;
    $matCode = sprintf("MAT-%03d", $mId);
    $name = addslashes($m[1]);
    $spec = addslashes($m[2]);
    $brand = addslashes($m[3]);
    $hsn = $m[4];
    $gst = $m[5];
    $rate = $m[6];
    $minStock = $m[7];
    $reorder = $m[8];
    $uomId = $m[9];
    $catId = $m[0];

    $matRows[] = "({$mId}, 1, {$catId}, {$uomId}, '{$matCode}', '{$name}', '{$spec}', '{$brand}', '{$hsn}', {$gst}, {$rate}, {$minStock}, {$reorder}, 'Main Site Central Store', 1, 0, 1, 'Standard civil engineering approved catalog material.', 1, 1, '2023-01-01', NOW(), NULL)";
}

$chunk = 100;
for ($i = 0; $i < count($matRows); $i += $chunk) {
    writeLine($fp, "INSERT INTO `materials` (`id`, `company_id`, `material_category_id`, `base_uom_id`, `material_code`, `material_name`, `specification`, `brand_preference`, `hsn_code`, `gst_rate`, `standard_rate`, `minimum_stock_qty`, `reorder_qty`, `storage_location_hint`, `quality_check_required`, `batch_tracking_required`, `is_active`, `notes`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at`) VALUES");
    writeLine($fp, implode(",\n", array_slice($matRows, $i, $chunk)));
    writeLine($fp, "ON DUPLICATE KEY UPDATE `material_name` = VALUES(`material_name`), `standard_rate` = VALUES(`standard_rate`);\n");
}

// ----------------------------------------------------------------------------
// 10.2 WORK CATEGORIES MASTERS & WORK CATEGORIES
// ----------------------------------------------------------------------------
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 10.2 WORK CATEGORIES & WORK STAGES");
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "INSERT INTO `work_categories_work_stage_masters` (`id`, `work_stage_code`, `work_stage_name`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1, 'PRE_CONSTRUCTION', 'Pre Construction', 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(2, 'SUBSTRUCTURE', 'Substructure', 2, 1, '2023-01-01', NOW()),");
writeLine($fp, "(3, 'SUPERSTRUCTURE', 'Superstructure', 3, 1, '2023-01-01', NOW()),");
writeLine($fp, "(4, 'FINISHING', 'Finishing', 4, 1, '2023-01-01', NOW()),");
writeLine($fp, "(5, 'MEP', 'Mep', 5, 1, '2023-01-01', NOW()),");
writeLine($fp, "(6, 'EXTERNAL', 'External', 6, 1, '2023-01-01', NOW()),");
writeLine($fp, "(7, 'HANDOVER', 'Handover', 7, 1, '2023-01-01', NOW()),");
writeLine($fp, "(8, 'OTHER', 'Other', 8, 1, '2023-01-01', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `work_stage_name` = VALUES(`work_stage_name`);\n");

writeLine($fp, "INSERT INTO `work_categories_progress_method_masters` (`id`, `progress_method_code`, `progress_method_name`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1, 'QUANTITY', 'Quantity', 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(2, 'PERCENTAGE', 'Percentage', 2, 1, '2023-01-01', NOW()),");
writeLine($fp, "(3, 'MILESTONE', 'Milestone', 3, 1, '2023-01-01', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `progress_method_name` = VALUES(`progress_method_name`);\n");

writeLine($fp, "INSERT INTO `work_categories` (`id`, `company_id`, `parent_id`, `category_code`, `category_name`, `work_stage_id`, `progress_method_id`, `description`, `display_order`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at`) VALUES");
writeLine($fp, "(1, 1, NULL, 'PRELIMINARY', 'Preliminary Works', 1, 3, 'Site setup, boundary fencing, surveying & temporary utilities', 10, 1, 1, 1, '2023-01-01', NOW(), NULL),");
writeLine($fp, "(2, 1, NULL, 'EARTHWORK', 'Earthwork and Excavation', 2, 1, 'Excavation, trenching, dewatering, soldier piles & soil backfill', 20, 1, 1, 1, '2023-01-01', NOW(), NULL),");
writeLine($fp, "(3, 1, NULL, 'FOUNDATION', 'Foundation Works', 2, 1, 'PCC leveling course, raft foundation, pile caps & ground beams', 30, 1, 1, 1, '2023-01-01', NOW(), NULL),");
writeLine($fp, "(4, 1, NULL, 'RCC', 'Reinforced Cement Concrete', 3, 1, 'Columns, shear walls, beams, post-tensioned slabs & structural PEB', 40, 1, 1, 1, '2023-01-01', NOW(), NULL),");
writeLine($fp, "(5, 1, NULL, 'MASONRY', 'Masonry Works', 3, 1, 'Red clay bricks, AAC blocks, solid concrete blocks & partition walls', 50, 1, 1, 1, '2023-01-01', NOW(), NULL),");
writeLine($fp, "(6, 1, NULL, 'PLASTERING', 'Plastering Works', 4, 1, 'Internal smooth plastering, external sand faced plaster & ceiling grid', 60, 1, 1, 1, '2023-01-01', NOW(), NULL),");
writeLine($fp, "(7, 1, NULL, 'FLOORING', 'Flooring and Tiling', 4, 1, 'Vitrified tiles, Italian marble, granite, vinyl & Trimix industrial floor', 70, 1, 1, 1, '2023-01-01', NOW(), NULL),");
writeLine($fp, "(8, 1, NULL, 'PAINTING', 'Painting Works', 4, 1, 'Acrylic wall putty, exterior Apex, interior Royale, epoxy & polish', 80, 1, 1, 1, '2023-01-01', NOW(), NULL),");
writeLine($fp, "(9, 1, NULL, 'MEP', 'MEP Works', 5, 2, 'Electrical conduits, VRV HVAC, fire sprinklers, MGPS gas & sanitaryware', 90, 1, 1, 1, '2023-01-01', NOW(), NULL),");
writeLine($fp, "(10, 1, NULL, 'EXTERNAL', 'External Development', 6, 1, 'Interlocking paver roads, storm water U-drains, water fountains & landscape', 100, 1, 1, 1, '2023-01-01', NOW(), NULL)");
writeLine($fp, "ON DUPLICATE KEY UPDATE `category_name` = VALUES(`category_name`);\n");

// ----------------------------------------------------------------------------
// 11. DETAILED BOQ LINE ITEMS (83 COMPREHENSIVE ITEMS ACROSS ALL 10 BOQS)
// ----------------------------------------------------------------------------
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 11. DETAILED BOQ LINE ITEMS (83 COMPREHENSIVE ITEMS FOR ALL SECTIONS)");
writeLine($fp, "-- ----------------------------------------------------------------------------");

$boqItemDefs = [
    // ==========================================
    // BOQ 501: KMC Hospital Inpatient Tower
    // ==========================================
    // Section 1: Substructure, Earthwork & Soldier Piling (Site 201, Zone 301)
    [1, 101, 501, 1, 201, 301, 2, 12, 'BOQ-ITEM-001', 'Earthwork excavation in all types of soil for foundation basement', 'Mechanized excavation including disposal within 5km lead', 12500.00, 120.00, 1500000.00, 5.0, 10.0],
    [2, 101, 501, 1, 201, 301, 3, 3, 'BOQ-ITEM-002', 'Plain Cement Concrete (PCC) 1:4:8 under raft and pile caps', 'M10 grade leveling course using 40mm metal aggregate', 450.00, 4200.00, 1890000.00, 3.0, 8.0],
    [3, 101, 501, 1, 201, 301, 4, 2, 'BOQ-ITEM-003', 'Thermo-Mechanically Treated (TMT) Fe550D rebar fabrication', 'Cutting, bending, binding with GI wire and placing in raft', 85.00, 68000.00, 5780000.00, 2.5, 20.0],
    [4, 101, 501, 1, 201, 301, 4, 3, 'BOQ-ITEM-004', 'Reinforced Cement Concrete (RCC) M30 Design Mix Raft Slab', 'Ready mix concrete pouring with pump, vibrator & water curing', 780.00, 5100.00, 3978000.00, 2.0, 18.0],
    [5, 101, 501, 1, 201, 301, 3, 6, 'BOQ-ITEM-005', 'Soldier pile drilling & bentonite mud stabilization', 'Bored cast-in-situ concrete soldier piles 600mm dia', 600.00, 2200.00, 1320000.00, 2.0, 8.0],

    // Section 2: RCC Superstructure, Columns & Slabs (Site 201, Zone 302)
    [6, 101, 501, 2, 201, 302, 4, 3, 'BOQ-ITEM-006', 'RCC M30 grade columns, shear walls, and lift core walls', 'Using film-faced shuttering plywood and automated batching', 620.00, 5300.00, 3286000.00, 2.0, 15.0],
    [7, 101, 501, 2, 201, 302, 4, 3, 'BOQ-ITEM-007', 'RCC M25 grade suspended beams and two-way floor slabs', 'Ready mix concrete with superplasticizers and monofilament fibres', 850.00, 4850.00, 4122500.00, 2.0, 18.0],
    [8, 101, 501, 2, 201, 302, 5, 4, 'BOQ-ITEM-008', 'Autoclaved Aerated Concrete (AAC) block masonry 200mm thick', 'Laid in polymer thin-bed adhesive mortar with vertical stiffeners', 3200.00, 950.00, 3040000.00, 3.0, 12.0],
    [9, 101, 501, 2, 201, 302, 6, 4, 'BOQ-ITEM-009', 'Internal plastering with P-Sand in CM 1:4 (12mm thick)', 'Smooth trowel finished surface ready for primer application', 7500.00, 185.00, 1387500.00, 2.0, 8.0],
    [10, 101, 501, 2, 201, 302, 6, 4, 'BOQ-ITEM-010', 'External sand faced cement plastering 20mm in CM 1:4', 'Double coat waterproof external plaster with curing compound', 4200.00, 240.00, 1008000.00, 2.5, 6.0],

    // Section 3: Modular OT Cleanroom & Medical Gas Piping (Site 201, Zone 302)
    [11, 101, 501, 3, 201, 302, 9, 4, 'BOQ-ITEM-011', 'Modular Operation Theatre SS 304 Wall Cladding & Ceiling', 'Cleanroom anti-bacterial seamless panels with coved corners', 480.00, 4200.00, 2016000.00, 1.0, 12.0],
    [12, 101, 501, 3, 201, 302, 9, 6, 'BOQ-ITEM-012', 'Medical Gas Pipeline System (MGPS) copper distribution line', 'Degreased medical grade oxygen, vacuum and nitrous oxide lines', 850.00, 1250.00, 1062500.00, 2.0, 8.0],
    [13, 101, 501, 3, 201, 302, 7, 4, 'BOQ-ITEM-013', 'Anti-bacterial seamless conductive vinyl flooring 2mm', 'Conductive vinyl roll with copper ground tape for OT rooms', 420.00, 1450.00, 609000.00, 3.0, 6.0],
    [14, 101, 501, 3, 201, 302, 9, 7, 'BOQ-ITEM-014', 'Cleanroom HEPA terminal filter units H14 class', '99.995% efficiency terminal laminar flow ceiling air units', 32.00, 12500.00, 400000.00, 0.0, 5.0],

    // Section 4: Hospital Electrical, HVAC & Architectural Finishes (Site 201, Zone 301)
    [15, 101, 501, 4, 201, 301, 9, 7, 'BOQ-ITEM-015', 'Point wiring for lighting, fans and 6A sockets with FRLS wire', 'In concealed heavy duty PVC conduits including modular plates', 650.00, 1150.00, 747500.00, 1.0, 6.0],
    [16, 101, 501, 4, 201, 301, 7, 5, 'BOQ-ITEM-016', 'Glazed Vitrified Tile (GVT) 600x1200mm flooring in corridors', 'Laid with polymer modified tile adhesive and epoxy grout joints', 18500.00, 115.00, 2127500.00, 3.0, 10.0],
    [17, 101, 501, 4, 201, 301, 8, 4, 'BOQ-ITEM-017', 'Premium Royale luxury interior paint and acrylic primer (2 coats)', 'Over 2 coats of polymer wall putty with dust-free sanding', 8500.00, 65.00, 552500.00, 2.0, 5.0],
    [18, 101, 501, 4, 201, 301, 9, 4, 'BOQ-ITEM-018', 'Centralized HVAC chilled water air handling ducting', 'Galvanized iron ductwork with closed-cell nitrile insulation', 1200.00, 1850.00, 2220000.00, 2.0, 8.0],

    // ==========================================
    // BOQ 502: KMC Doctors Quarters & Pharmacy
    // ==========================================
    // Section 5: Doctor Quarters Structural Framework (Site 202, Zone 305)
    [19, 101, 502, 5, 202, 305, 4, 3, 'BOQ-ITEM-019', 'RCC M25 column, beam & floor slab framed structure', 'Standard framed RCC structure for 4-storey residential quarters', 380.00, 4850.00, 1843000.00, 2.0, 18.0],
    [20, 101, 502, 5, 202, 305, 5, 4, 'BOQ-ITEM-020', 'Solid concrete block masonry 200mm thick', 'Hydraulically pressed cement blocks in CM 1:5 mortar', 1400.00, 720.00, 1008000.00, 3.0, 12.0],
    [21, 101, 502, 5, 202, 305, 7, 5, 'BOQ-ITEM-021', 'Vitrified double charge floor tiling 600x600mm', 'Premium polished floor tiles with paper joints', 6500.00, 85.00, 552500.00, 3.0, 8.0],
    [22, 101, 502, 5, 202, 305, 8, 7, 'BOQ-ITEM-022', 'Flush door shutters 35mm with teak veneer & Godrej locks', 'BWP grade solid core doors with brass handles and mortise lock', 45.00, 6800.00, 306000.00, 1.0, 6.0],

    // Section 6: Pharmacy Cold Storage & Sanitary Fitout (Site 202, Zone 306)
    [23, 101, 502, 6, 202, 306, 9, 4, 'BOQ-ITEM-023', 'PUF insulated modular cold storage chamber 100mm', 'High density polyurethane foam wall panels with cam locks', 180.00, 3800.00, 684000.00, 1.0, 12.0],
    [24, 101, 502, 6, 202, 306, 9, 6, 'BOQ-ITEM-024', 'CPVC & UPVC water supply plumbing risers', 'Heavy duty pressure pipes with brass fittings and valves', 450.00, 650.00, 292500.00, 2.0, 8.0],
    [25, 101, 502, 6, 202, 306, 9, 10, 'BOQ-ITEM-025', 'Cera wall hung sanitary toilet closets & vanity wash basins', 'Vitreous china rimless WC with concealed flush tanks', 30.00, 11500.00, 345000.00, 0.0, 8.0],
    [26, 101, 502, 6, 202, 306, 9, 7, 'BOQ-ITEM-026', 'Heavy duty stainless steel utility wash sinks', 'Grade 304 satin finish double bowl sink with drainboard', 12.00, 12000.00, 144000.00, 0.0, 5.0],

    // ==========================================
    // BOQ 503: Valluvar Grand 4-Star Hotel Tower
    // ==========================================
    // Section 7: Basement Car Parking & Retaining Wall (Site 203, Zone 308)
    [27, 102, 503, 7, 203, 308, 3, 3, 'BOQ-ITEM-027', 'Diaphragm retaining wall RCC M35 concrete', 'Deep basement earth retention perimeter concrete wall', 420.00, 5600.00, 2352000.00, 2.0, 15.0],
    [28, 102, 503, 7, 203, 308, 7, 4, 'BOQ-ITEM-028', 'Heavy duty basement floor Trimix vacuum dewatered concrete', 'VDF concrete flooring with quartz hardener topping', 1800.00, 680.00, 1224000.00, 2.0, 10.0],
    [29, 102, 503, 7, 203, 308, 7, 4, 'BOQ-ITEM-029', 'Vehicular ramp chequered plate & anti-skid grooving', 'Anti-skid tear drop pattern heavy vehicle entry ramp', 350.00, 950.00, 332500.00, 2.0, 6.0],

    // Section 8: Hotel Tower Framed Superstructure (Site 203, Zone 307)
    [30, 102, 503, 8, 203, 307, 4, 3, 'BOQ-ITEM-030', 'Double height grand banquet hall RCC M30 frame', 'Double height pillarless post-tensioned beam framework', 520.00, 5600.00, 2912000.00, 2.0, 15.0],
    [31, 102, 503, 8, 203, 307, 4, 3, 'BOQ-ITEM-031', 'Upper guest floors post-tensioned slab & columns', 'Floors 1-6 bonded post-tensioned slab high strength concrete', 740.00, 5200.00, 3848000.00, 2.0, 16.0],
    [32, 102, 503, 8, 203, 307, 5, 4, 'BOQ-ITEM-032', 'AAC lightweight partition blocks 150mm', 'Acoustic hotel room dividing walls in thin bed adhesive', 2800.00, 880.00, 2464000.00, 3.0, 10.0],
    [33, 102, 503, 8, 203, 307, 8, 4, 'BOQ-ITEM-033', 'Exterior weatherproof acrylic texture coat paint', 'Roller applied stone stucco finish external weather coat', 5500.00, 110.00, 605000.00, 2.0, 6.0],

    // Section 9: Central VRV HVAC, Italian Marble & Interiors (Site 203, Zone 308)
    [34, 102, 503, 9, 203, 308, 7, 5, 'BOQ-ITEM-034', 'Imported Italian Statuario marble foyer & lobby flooring', 'Mirror polished bookmatched marble laid on CM 1:4 with white cement', 8500.00, 550.00, 4675000.00, 4.0, 22.0],
    [35, 102, 503, 9, 203, 308, 9, 10, 'BOQ-ITEM-035', 'Daikin Centralized VRV-X HVAC System 16 HP units', 'Multi-zone inverter air conditioning with touch controls', 24.00, 145000.00, 3480000.00, 0.0, 18.0],
    [36, 102, 503, 9, 203, 309, 10, 4, 'BOQ-ITEM-036', 'Rooftop infinity pool 2K polymer waterproofing & glass mosaic', '2K flexible coating, APP membrane and imported glass tiles', 380.00, 2400.00, 912000.00, 2.0, 8.0],
    [37, 102, 503, 9, 203, 308, 9, 7, 'BOQ-ITEM-037', 'Automatic fire sprinkler system with landing valves', 'Heavy class black steel fire sprinkler piping & quick glass bulbs', 420.00, 1850.00, 777000.00, 1.0, 6.0],

    // ==========================================
    // BOQ 504: Valluvar Convention Centre & MLCP
    // ==========================================
    // Section 10: Convention Auditorium 2000-Seater Superstructure (Site 204, Zone 310)
    [38, 102, 504, 10, 204, 310, 4, 3, 'BOQ-ITEM-038', 'Long-span prestressed auditorium roof concrete girders', 'High strength pre-tensioned prestressed concrete roof beams', 480.00, 6200.00, 2976000.00, 2.0, 16.0],
    [39, 102, 504, 10, 204, 310, 6, 5, 'BOQ-ITEM-039', 'Mineral acoustic ceiling panel tiles 2x2 Ft', 'NRC 0.65 acoustic suspended drop ceiling grid', 14000.00, 95.00, 1330000.00, 2.0, 10.0],
    [40, 102, 504, 10, 204, 310, 7, 5, 'BOQ-ITEM-040', 'Stage heavy teak wood sprung cushion flooring', 'Seasoned hardwood sprung dance/theatre floor with polish', 2500.00, 420.00, 1050000.00, 2.0, 8.0],
    [41, 102, 504, 10, 204, 310, 9, 10, 'BOQ-ITEM-041', 'Motorized theatrical illumination grid & dimmers', 'DMX computerized auditorium stage lighting truss', 8.00, 185000.00, 1480000.00, 0.0, 8.0],

    // Section 11: Multi-Level Car Parking & Commercial Kitchen (Site 204, Zone 311)
    [42, 102, 504, 11, 204, 311, 4, 3, 'BOQ-ITEM-042', 'MLCP multi-tier reinforced concrete ramps and decks', 'M30 RCC post-tensioned multi-level car parking slabs', 380.00, 5100.00, 1938000.00, 2.0, 14.0],
    [43, 102, 504, 11, 204, 311, 7, 4, 'BOQ-ITEM-043', 'High gloss heavy traffic epoxy floor coating in parking', '3-Coat solvent free self leveling epoxy floor system', 2400.00, 580.00, 1392000.00, 2.0, 10.0],
    [44, 102, 504, 11, 204, 312, 9, 10, 'BOQ-ITEM-044', 'Commercial kitchen stainless steel drain gullies & grease traps', 'SS 304 food-grade grease interceptors and wash gullies', 16.00, 28000.00, 448000.00, 0.0, 6.0],
    [45, 102, 504, 11, 204, 312, 9, 6, 'BOQ-ITEM-045', 'Industrial LPG cylinder manifold pipeline distribution', 'Seamless copper and carbon steel gas piping with safety valves', 320.00, 1650.00, 528000.00, 1.0, 6.0],

    // ==========================================
    // BOQ 505: Bosch Sales & Experience Showroom
    // ==========================================
    // Section 12: Portal Steel Superstructure & PEB Roofing (Site 205, Zone 313)
    [46, 103, 505, 12, 205, 313, 4, 2, 'BOQ-ITEM-046', 'Pre-Engineered portal steel structural frame fabrication', 'High tensile steel columns, rafter beams & sag rods', 45.00, 82000.00, 3690000.00, 1.5, 25.0],
    [47, 103, 505, 12, 205, 313, 4, 6, 'BOQ-ITEM-047', 'Galvanized cold-formed Z-purlins 200mm', 'Pre-galvanized high tensile roof support purlins', 850.00, 420.00, 357000.00, 2.0, 6.0],
    [48, 103, 505, 12, 205, 313, 4, 4, 'BOQ-ITEM-048', 'Insulated trapezoidal sandwich roof decking sheet', '0.5mm Galvalume sheet with 50mm PUF thermal core', 1200.00, 680.00, 816000.00, 2.0, 10.0],

    // Section 13: Double Glazed Glass Facade & Customer Lounge (Site 205, Zone 313)
    [49, 103, 505, 13, 205, 313, 10, 5, 'BOQ-ITEM-049', 'Double Glazed (DGU) Low-E structural curtain wall facade', 'Spider glazing point fixed system with 12mm toughened glass', 4200.00, 420.00, 1764000.00, 2.0, 18.0],
    [50, 103, 505, 13, 205, 313, 7, 4, 'BOQ-ITEM-050', 'High gloss heavy traffic showroom vitrified tiles 600x1200mm', 'Stain resistant high albedo tiles for car showroom floor', 850.00, 1250.00, 1062500.00, 3.0, 12.0],
    [51, 103, 505, 13, 205, 313, 10, 10, 'BOQ-ITEM-051', 'Automatic frameless sliding sensor entrance glass doors', 'Dual microwave radar motion sensor automated entrance', 2.00, 145000.00, 290000.00, 0.0, 6.0],
    [52, 103, 505, 13, 205, 313, 9, 10, 'BOQ-ITEM-052', 'Customer lounge modular LED panel lighting & cove lights', 'Philips 36W LED office panels and indirect warm cove strips', 35.00, 8500.00, 297500.00, 0.0, 6.0],

    // ==========================================
    // BOQ 506: Bosch Workshop & Bodyshop
    // ==========================================
    // Section 14: Heavy Duty Flooring & Hydraulic Lift Foundations (Site 206, Zone 316)
    [53, 103, 506, 14, 206, 316, 7, 4, 'BOQ-ITEM-053', 'Vacuum Dewatered (Trimix) industrial floor with hardener', 'M25 concrete with quartz non-metallic dry shake hardener', 1200.00, 680.00, 816000.00, 2.0, 14.0],
    [54, 103, 506, 14, 206, 316, 3, 7, 'BOQ-ITEM-054', 'Reinforced concrete foundation pit for 4-post vehicle lift', 'Deep RCC foundation with embedded anchor plates M30', 8.00, 45000.00, 360000.00, 0.0, 8.0],
    [55, 103, 506, 14, 206, 316, 9, 6, 'BOQ-ITEM-055', 'High pressure pneumatic airline ring distribution piping', 'Aluminium compressed air ring pipeline with quick connectors', 350.00, 820.00, 287000.00, 1.0, 6.0],

    // Section 15: Automated Paint Booth & Multi-Tier Spare Racks (Site 206, Zone 317)
    [56, 103, 506, 15, 206, 317, 9, 10, 'BOQ-ITEM-056', 'Automated dust-free downdraft vehicle paint spray booth', 'Downdraft heating and exhaust ducting system with VFD fan', 2.00, 650000.00, 1300000.00, 0.0, 20.0],
    [57, 103, 506, 15, 206, 318, 4, 2, 'BOQ-ITEM-057', 'Heavy duty multi-tier steel warehouse racking for spare parts', 'Heavy slotted angle multi-tier storage mezzanine system', 8.50, 92000.00, 782000.00, 1.0, 10.0],
    [58, 103, 506, 15, 206, 317, 10, 7, 'BOQ-ITEM-058', 'Motorized galvanized steel rolling shutters 4x3.5m', '0.9mm interlocking steel lath with heavy electric drive motor', 6.00, 52000.00, 312000.00, 0.0, 6.0],

    // ==========================================
    // BOQ 507: Chettinad Engineering Academic Block
    // ==========================================
    // Section 16: Academic Block Excavation & Foundation Raft (Site 207, Zone 319)
    [59, 104, 507, 16, 207, 319, 2, 12, 'BOQ-ITEM-059', 'Campus bulk earthwork excavation & soil compaction', 'Clearing, grubbing and compaction in 200mm layers', 35000.00, 85.00, 2975000.00, 3.0, 10.0],
    [60, 104, 507, 16, 207, 319, 3, 3, 'BOQ-ITEM-060', 'Plain cement concrete PCC 1:4:8 under columns & raft', 'M10 grade leveling course using 40mm metal aggregate', 650.00, 4200.00, 2730000.00, 2.0, 8.0],
    [61, 104, 507, 16, 207, 319, 4, 2, 'BOQ-ITEM-061', 'TMT Fe550D structural rebar for foundation raft', 'Cutting, bending and placing steel in heavy foundation raft', 120.00, 67000.00, 8040000.00, 2.0, 20.0],
    [62, 104, 507, 16, 207, 319, 4, 3, 'BOQ-ITEM-062', 'RCC M30 concrete pour for raft slab & pedestals', 'Ready mix concrete with pump placing and wet curing', 1100.00, 5100.00, 5610000.00, 2.0, 16.0],

    // Section 17: Smart Classrooms & Engineering Laboratory Wings (Site 207, Zone 319)
    [63, 104, 507, 17, 207, 319, 4, 3, 'BOQ-ITEM-063', '4-Storey RCC M25 columns, beams & slab superstructure', 'Framed concrete building with automated pump pouring', 1450.00, 4850.00, 7032500.00, 2.0, 18.0],
    [64, 104, 507, 17, 207, 319, 9, 7, 'BOQ-ITEM-064', 'Smart classrooms fabric acoustic panelling & AV wiring', 'Fire rated fabric wrapped acoustic panels and interactive displays', 32.00, 220000.00, 7040000.00, 1.0, 22.0],
    [65, 104, 507, 17, 207, 319, 9, 6, 'BOQ-ITEM-065', 'Cat-6 Gigabit Ethernet high density structured cabling', 'UTP solid copper networking with rack patch panels', 4500.00, 165.00, 742500.00, 2.0, 6.0],
    [66, 104, 507, 17, 207, 320, 7, 5, 'BOQ-ITEM-066', 'Black Galaxy Granite laboratory workstation counter slabs', 'Chemical resistant polished granite workbenches 20mm', 4500.00, 220.00, 990000.00, 3.0, 8.0],

    // ==========================================
    // BOQ 508: Chettinad Student Hostel & Sports Stadium
    // ==========================================
    // Section 18: Hostel Blocks A & B Residential Structure (Site 208, Zone 322)
    [67, 104, 508, 18, 208, 322, 4, 3, 'BOQ-ITEM-067', 'Hostel RCC framed residential tower structure', 'M25 grade columns, beams, staircase and two-way slabs', 950.00, 4850.00, 4607500.00, 2.0, 16.0],
    [68, 104, 508, 18, 208, 322, 5, 4, 'BOQ-ITEM-068', 'Fly ash brick internal room masonry partitions', 'Lightweight cement flyash brick masonry in CM 1:5', 3800.00, 680.00, 2584000.00, 3.0, 12.0],
    [69, 104, 508, 18, 208, 322, 10, 7, 'BOQ-ITEM-069', 'UPVC casement windows 2-leaf with mosquito wire mesh', 'Multi-chambered steel reinforced acoustic windows', 180.00, 7500.00, 1350000.00, 1.0, 8.0],
    [70, 104, 508, 18, 208, 322, 9, 10, 'BOQ-ITEM-070', 'Centralized roof solar water heating pipeline installation', 'Insulated solar collector panels with CPVC hot lines', 4.00, 165000.00, 660000.00, 0.0, 6.0],

    // Section 19: Sports Stadium & Central Mess Dining Hall (Site 208, Zone 324)
    [71, 104, 508, 19, 208, 324, 4, 2, 'BOQ-ITEM-071', 'Indoor sports arena tubular steel structural roof truss', 'Curved circular hollow steel structural roof framework', 28.00, 84000.00, 2352000.00, 1.5, 14.0],
    [72, 104, 508, 19, 208, 324, 7, 4, 'BOQ-ITEM-072', 'Indoor Sports Badminton Arena Teak Wood Cushion Flooring', 'BWF approved sprung wooden sports flooring with polyurethane coat', 650.00, 3400.00, 2210000.00, 2.0, 15.0],
    [73, 104, 508, 19, 208, 324, 7, 5, 'BOQ-ITEM-073', 'Student mess dining hall heavy vitrified floor tiling', 'Heavy traffic anti-slip vitrified tiles with epoxy joints', 9500.00, 95.00, 902500.00, 3.0, 8.0],
    [74, 104, 508, 19, 208, 324, 9, 10, 'BOQ-ITEM-074', 'Stainless steel commercial mess steam cooking range line', 'Commercial steam boilers, rice cookers & exhaust hood', 6.00, 125000.00, 750000.00, 0.0, 6.0],

    // ==========================================
    // BOQ 509: KMC Healthcare Oncology Bunker
    // ==========================================
    // Section 20: High-Density Radiation Shielding Concrete (Site 201, Zone 303)
    [75, 101, 509, 20, 201, 303, 4, 3, 'BOQ-ITEM-075', 'High density heavy barite radiation shielding concrete 1200mm', '3200 kg/m3 barite aggregate concrete for LINAC bunker', 240.00, 8500.00, 2040000.00, 2.0, 20.0],
    [76, 101, 509, 20, 201, 303, 4, 2, 'BOQ-ITEM-076', 'Staggered heavy TMT 32mm rebar density cage', 'Primary Fe550D staggered heavy reinforcement cage', 18.00, 72000.00, 1296000.00, 2.0, 15.0],
    [77, 101, 509, 20, 201, 303, 10, 10, 'BOQ-ITEM-077', 'Motorized 100mm lead radiation barrier sliding door', 'Motorized steel jacketed lead radiation door with interlock', 1.00, 450000.00, 450000.00, 0.0, 10.0],
    [78, 101, 509, 20, 201, 303, 3, 1, 'BOQ-ITEM-078', 'Non-shrink high precision chemical pressure grouting', 'Conbextra GP2 non-shrink cementitious grout injection', 120.00, 850.00, 102000.00, 2.0, 5.0],

    // ==========================================
    // BOQ 510: Valluvar Riverfront Landscaping
    // ==========================================
    // Section 21: Promenade Hardscape, Stone Amphitheatre & Plants (Site 203, Zone 307)
    [79, 102, 510, 21, 203, 307, 7, 5, 'BOQ-ITEM-079', 'Natural calibrated Kotah stone outdoor walkway paving', 'Honed non-slip blue limestone slabs for river promenade', 8500.00, 110.00, 935000.00, 3.0, 12.0],
    [80, 102, 510, 21, 203, 307, 10, 4, 'BOQ-ITEM-080', 'Interlocking 80mm heavy duty zig-zag driveway pavers', 'M40 grade machine pressed vehicular pavement blocks', 850.00, 580.00, 493000.00, 2.0, 8.0],
    [81, 102, 510, 21, 203, 307, 5, 6, 'BOQ-ITEM-081', 'Riverfront stone amphitheatre tiered seat walling', 'Granite block masonry with bull-nosed edge capping', 280.00, 1450.00, 406000.00, 2.0, 8.0],
    [82, 102, 510, 21, 203, 307, 10, 10, 'BOQ-ITEM-082', 'Programmable musical dancing water fountain jet system', 'Submersible fountain pumps, multi-color LED & nozzles', 2.00, 185000.00, 370000.00, 0.0, 8.0],
    [83, 102, 510, 21, 203, 307, 9, 7, 'BOQ-ITEM-083', 'Solar LED landscape bollard illumination lights', 'Commercial solar powered IP66 outdoor bollard fixtures', 45.00, 3800.00, 171000.00, 0.0, 6.0]
];

writeLine($fp, "INSERT INTO `boq_items` (`id`, `company_id`, `project_id`, `boq_id`, `section_id`, `site_id`, `work_zone_id`, `work_category_id`, `uom_id`, `item_code`, `item_name`, `specification`, `quantity`, `rate`, `amount`, `wastage_percentage`, `progress_weightage`, `is_provisional`, `display_order`, `notes`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at`) VALUES");
$itemRows = [];
foreach ($boqItemDefs as $idx => $it) {
    $itemRows[] = "({$it[0]}, 1, {$it[1]}, {$it[2]}, {$it[3]}, {$it[4]}, {$it[5]}, {$it[6]}, {$it[7]}, '{$it[8]}', '" . addslashes($it[9]) . "', '" . addslashes($it[10]) . "', {$it[11]}, {$it[12]}, {$it[13]}, {$it[14]}, {$it[15]}, 0, " . ($idx + 1) . ", 'Comprehensive detailed engineering item.', 1, 1, '2023-01-10', NOW(), NULL)";
}
writeLine($fp, implode(",\n", $itemRows));
writeLine($fp, "ON DUPLICATE KEY UPDATE `item_name` = VALUES(`item_name`), `amount` = VALUES(`amount`);\n");

// ----------------------------------------------------------------------------
// 12. PROJECT MASTER BUDGETS
// ----------------------------------------------------------------------------
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 12. PROJECT MASTER BUDGETS");
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "INSERT INTO `project_budgets` (`id`, `company_id`, `project_id`, `financial_year_id`, `budget_code`, `budget_name`, `version_no`, `budget_date`, `currency_code`, `direct_cost`, `overhead_cost`, `contingency_amount`, `total_budget`, `status_id`, `created_by`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(901, 1, 101, 2, 'BUD-KRR-001', 'KMC hospital Approved Master Budget', 1, '2023-01-10', 'INR', 8075000.00, 950000.00, 475000.00, 9500000.00, 2, 1, '2023-01-10', NOW()),");
writeLine($fp, "(902, 1, 102, 3, 'BUD-KRR-002', 'Valluvar hotel Approved Master Budget', 1, '2024-01-20', 'INR', 10200000.00, 1200000.00, 600000.00, 12000000.00, 2, 1, '2024-01-20', NOW()),");
writeLine($fp, "(903, 1, 103, 4, 'BUD-KRR-003', 'Bosch Showroom Approved Master Budget', 1, '2025-05-20', 'INR', 5100000.00, 600000.00, 300000.00, 6000000.00, 2, 1, '2025-05-20', NOW()),");
writeLine($fp, "(904, 1, 104, 5, 'BUD-KRR-004', 'Chettinad college Draft Master Budget', 1, '2026-09-05', 'INR', 15300000.00, 1800000.00, 900000.00, 18000000.00, 1, 1, '2026-09-05', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `total_budget` = VALUES(`total_budget`);\n");

// ----------------------------------------------------------------------------
// 13. MATERIAL SUPPLIERS, PURCHASE ORDERS & INVENTORY TRANSACTIONS
// ----------------------------------------------------------------------------
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 13. MATERIAL SUPPLIERS & PROCUREMENT WORKFLOW");
writeLine($fp, "-- ----------------------------------------------------------------------------");

writeLine($fp, "INSERT INTO `material_suppliers` (`id`, `company_id`, `supplier_code`, `supplier_name`, `contact_person`, `phone`, `email`, `city`, `state_name`, `rating`, `status_id`, `created_by`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1, 1, 'SUP-KRR-01', 'Kongu Steel & TMT Distributors Karur', 'M. Saravanan', '9842477701', 'sales@kongusteel.in', 'Karur', 'Tamil Nadu', 4.8, 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(2, 1, 'SUP-KRR-02', 'UltraTech Building Solutions & RMC Karur', 'S. Muthukumar', '9842477702', 'karur@ultratech.com', 'Karur', 'Tamil Nadu', 4.9, 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(3, 1, 'SUP-KRR-03', 'Amaravathi Blue Metal Quarry & M-Sand', 'K. Murugan', '9842477703', 'orders@amaravathiaggregates.com', 'Karur', 'Tamil Nadu', 4.7, 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(4, 1, 'SUP-KRR-04', 'Kajaria & Somany Tiles Studio Karur', 'P. Dharmalingam', '9842477704', 'tiles@kajarikarur.com', 'Karur', 'Tamil Nadu', 4.8, 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(5, 1, 'SUP-KRR-05', 'Schneider & Polycab Electrical Agencies', 'N. Ramachandran', '9842477705', 'electricals@polycabkarur.in', 'Karur', 'Tamil Nadu', 4.6, 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(6, 1, 'SUP-KRR-06', 'Fosroc & Sika Construction Chemicals Karur', 'V. Balasubramanian', '9842477706', 'chemicals@fosrockarur.com', 'Karur', 'Tamil Nadu', 4.9, 1, 1, '2023-01-01', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `supplier_name` = VALUES(`supplier_name`);\n");

// ----------------------------------------------------------------------------
// 14. SUBCONTRACTORS, LABOUR CONTRACTORS & REGISTERED WORKERS
// ----------------------------------------------------------------------------
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 14. SUBCONTRACTORS, LABOUR CONTRACTORS & 40 REGISTERED WORKERS");
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "INSERT INTO `subcontractors_contractor_type_masters` (`id`, `contractor_type_code`, `contractor_type_name`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1, 'CIVIL_STRUCTURAL', 'Civil & Structural Contractor', 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(2, 'MEP_HVAC', 'MEP, HVAC & Electrical Contractor', 2, 1, '2023-01-01', NOW()),");
writeLine($fp, "(3, 'STEEL_FABRICATION', 'Steel Fabrication & Glass Glazing', 3, 1, '2023-01-01', NOW()),");
writeLine($fp, "(4, 'FINISHING_PAINTING', 'Finishing, Flooring & Painting', 4, 1, '2023-01-01', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `contractor_type_name` = VALUES(`contractor_type_name`);\n");

writeLine($fp, "INSERT INTO `subcontractors` (`id`, `company_id`, `contractor_type_id`, `contractor_code`, `contractor_name`, `contact_person`, `phone`, `email`, `city`, `status_id`, `created_by`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(501, 1, 1, 'CON-KRR-01', 'Karur Civil & Masonry Works', 'M. Velusamy', '9842455501', 'velusamy@karurcivil.com', 'Karur', 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(502, 1, 2, 'CON-KRR-02', 'Amaravathi Electricals & Plumbing', 'S. Natarajan', '9842455502', 'natarajan@amaravathimep.com', 'Karur', 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(503, 1, 3, 'CON-KRR-03', 'Kongu Steel & Fabrication', 'K. Murugesan', '9842455503', 'murugesan@kongusteel.com', 'Karur', 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(504, 1, 4, 'CON-KRR-04', 'Pasupathieswarar Finishing & Painting', 'P. Dharmalingam', '9842455504', 'dharmalingam@pasupathifinish.com', 'Karur', 1, 1, '2023-01-01', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `contractor_name` = VALUES(`contractor_name`);\n");

writeLine($fp, "INSERT INTO `labour_contractors` (`id`, `company_id`, `subcontractor_id`, `contractor_code`, `contractor_name`, `contact_person`, `phone`, `status_id`, `created_by`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(501, 1, 501, 'LC-KRR-01', 'Karur Civil & Masonry Works', 'M. Velusamy', '9842455501', 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(502, 1, 502, 'LC-KRR-02', 'Amaravathi Electricals & Plumbing', 'S. Natarajan', '9842455502', 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(503, 1, 503, 'LC-KRR-03', 'Kongu Steel & Fabrication', 'K. Murugesan', '9842455503', 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(504, 1, 504, 'LC-KRR-04', 'Pasupathieswarar Finishing & Painting', 'P. Dharmalingam', '9842455504', 1, 1, '2023-01-01', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `contractor_name` = VALUES(`contractor_name`);\n");

writeLine($fp, "INSERT INTO `labour_workers` (`id`, `company_id`, `labour_category_id`, `contractor_id`, `worker_code`, `worker_name`, `employment_source_id`, `gender_id`, `phone`, `id_type_id`, `date_joined`, `wage_basis_id`, `base_wage_rate`, `overtime_rate_per_hour`, `status_id`, `created_by`, `created_at`, `updated_at`) VALUES");
$firstNames = ['Murugan', 'Kandasamy', 'Thangaraj', 'Senthilkumar', 'Boopathi', 'Manikandan', 'Saravanan', 'Ganesan', 'Palanisamy', 'Periasamy', 'Subramani', 'Dhanapal', 'Ramasamy', 'Karthikeyan', 'Suresh', 'Vignesh', 'Prabhu', 'Rajendran', 'Arumugam', 'Marimuthu'];
for ($w = 1; $w <= 40; $w++) {
    $cId = 501 + (($w - 1) % 4);
    $wName = $firstNames[($w - 1) % count($firstNames)] . ' ' . chr(65 + ($w % 20));
    $wCode = sprintf("WRK-%03d", $w);
    $phone = sprintf("984246%04d", $w);
    $wage = 750.00 + (($w % 5) * 50);
    $otWage = round($wage / 8 * 1.5, 2);
    $catId = 1 + ($w % 6);
    writeLine($fp, "({$w}, 1, {$catId}, {$cId}, '{$wCode}', '{$wName}', 1, 1, '{$phone}', 1, '2023-01-01', 1, {$wage}, {$otWage}, 1, 1, '2023-01-01', NOW()),");
}
writeLine($fp, "(41, 1, 1, 501, 'WRK-041', 'Velumani C', 1, 1, '9842469999', 1, '2023-01-01', 1, 850.00, 160.00, 1, 1, '2023-01-01', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `worker_name` = VALUES(`worker_name`);\n");

// ----------------------------------------------------------------------------
// 15. SUBCONTRACT WORK ORDERS
// ----------------------------------------------------------------------------
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 15. SUBCONTRACT WORK ORDERS");
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "INSERT INTO `subcontract_work_orders` (`id`, `company_id`, `project_id`, `site_id`, `contractor_id`, `work_order_no`, `work_order_date`, `start_date`, `scope_of_work`, `currency_code`, `total_order_value`, `status_id`, `created_by`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(801, 1, 101, 201, 501, 'WO-KMC-001-RCC', '2023-01-20', '2023-01-20', 'Hospital ICU & OT structural RCC concrete framework and masonry.', 'INR', 4200000.00, 3, 1, '2023-01-20', NOW()),");
writeLine($fp, "(802, 1, 101, 201, 502, 'WO-KMC-002-MEP', '2023-02-15', '2023-02-15', 'Medical gas piping, hospital electrical panel & HVAC ducting.', 'INR', 3500000.00, 3, 1, '2023-02-15', NOW()),");
writeLine($fp, "(803, 1, 102, 203, 501, 'WO-VAL-001-CIVIL', '2024-02-10', '2024-02-10', 'Hotel tower multi-storey framing, basement parking & banquet hall.', 'INR', 5500000.00, 3, 1, '2024-02-10', NOW()),");
writeLine($fp, "(804, 1, 102, 203, 504, 'WO-VAL-002-FINISH', '2024-03-01', '2024-03-01', 'Hotel suites acoustic plastering, vitrified flooring & painting.', 'INR', 3800000.00, 3, 1, '2024-03-01', NOW()),");
writeLine($fp, "(805, 1, 103, 205, 503, 'WO-BSH-001-STEEL', '2025-06-10', '2025-06-10', 'Showroom portal steel frame fabrication, structural glass curtain wall.', 'INR', 2500000.00, 2, 1, '2025-06-10', NOW()),");
writeLine($fp, "(806, 1, 103, 205, 501, 'WO-BSH-002-CIVIL', '2025-06-15', '2025-06-15', 'Workshop heavy duty flooring, service pits, drainage & offices.', 'INR', 1800000.00, 2, 1, '2025-06-15', NOW()),");
writeLine($fp, "(807, 1, 104, 207, 501, 'WO-CHT-001-DRAFT', '2026-09-10', '2026-11-01', 'Draft: Academic block foundation excavation & mass concrete.', 'INR', 6500000.00, 1, 1, '2026-09-10', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `total_order_value` = VALUES(`total_order_value`);\n");

// ----------------------------------------------------------------------------
// 16. LABOUR PROJECT ASSIGNMENTS & DAILY ATTENDANCE
// ----------------------------------------------------------------------------
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 16. LABOUR PROJECT ASSIGNMENTS & ATTENDANCE BATCHES");
writeLine($fp, "-- ----------------------------------------------------------------------------");

writeLine($fp, "INSERT INTO `labour_project_assignments_status_masters` (`id`, `status_code`, `status_name`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1, 'PENDING', 'Pending', 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(2, 'ACTIVE', 'Active', 2, 1, '2023-01-01', NOW()),");
writeLine($fp, "(3, 'COMPLETED', 'Completed', 3, 1, '2023-01-01', NOW()),");
writeLine($fp, "(4, 'TERMINATED', 'Terminated', 4, 1, '2023-01-01', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `status_name` = VALUES(`status_name`);\n");

writeLine($fp, "INSERT INTO `labour_attendance_batches_status_masters` (`id`, `status_code`, `status_name`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1, 'DRAFT', 'Draft', 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(2, 'SUBMITTED', 'Submitted', 2, 1, '2023-01-01', NOW()),");
writeLine($fp, "(3, 'APPROVED', 'Approved', 3, 1, '2023-01-01', NOW()),");
writeLine($fp, "(4, 'REJECTED', 'Rejected', 4, 1, '2023-01-01', NOW()),");
writeLine($fp, "(5, 'LOCKED', 'Locked', 5, 1, '2023-01-01', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `status_name` = VALUES(`status_name`);\n");

writeLine($fp, "INSERT INTO `labour_attendance_entries_attendance_status_masters` (`id`, `attendance_status_code`, `attendance_status_name`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1, 'PRESENT', 'Present', 1, 1, '2023-01-01', NOW()),");
writeLine($fp, "(2, 'ABSENT', 'Absent', 2, 1, '2023-01-01', NOW()),");
writeLine($fp, "(3, 'HALF_DAY', 'Half Day', 3, 1, '2023-01-01', NOW()),");
writeLine($fp, "(4, 'PAID_LEAVE', 'Paid Leave', 4, 1, '2023-01-01', NOW()),");
writeLine($fp, "(5, 'UNPAID_LEAVE', 'Unpaid Leave', 5, 1, '2023-01-01', NOW()),");
writeLine($fp, "(6, 'WEEKLY_OFF', 'Weekly Off', 6, 1, '2023-01-01', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `attendance_status_name` = VALUES(`attendance_status_name`);\n");

$assignRows = [];
$projectsForAssign = [
    ['proj_id' => 101, 'site_id' => 201, 'from' => '2023-01-15'],
    ['proj_id' => 102, 'site_id' => 203, 'from' => '2024-02-01'],
    ['proj_id' => 103, 'site_id' => 205, 'from' => '2025-06-01'],
    ['proj_id' => 104, 'site_id' => 207, 'from' => '2026-09-01']
];

foreach ($projectsForAssign as $pfa) {
    for ($w = 1; $w <= 40; $w++) {
        $assignId = ($pfa['proj_id'] * 100) + $w;
        $wage = 750.00 + (($w % 5) * 50);
        $otWage = round($wage / 8 * 1.5, 2);
        $catId = 1 + ($w % 6);
        $assignRows[] = sprintf(
            "(%d, 1, %d, %d, NULL, %d, %d, '%s', NULL, 1, %.2f, %.2f, 'General Shift', 2, 'Assigned to site workforce', 1, 1, '%s 00:00:00', NOW())",
            $assignId, $pfa['proj_id'], $pfa['site_id'], $w, $catId, $pfa['from'], $wage, $otWage, $pfa['from']
        );
    }
}

writeLine($fp, "INSERT INTO `labour_project_assignments` (`id`, `company_id`, `project_id`, `site_id`, `zone_id`, `worker_id`, `labour_category_id`, `assigned_from`, `assigned_until`, `wage_basis_id`, `agreed_wage_rate`, `overtime_rate`, `shift_name`, `status_id`, `remarks`, `created_by`, `updated_by`, `created_at`, `updated_at`) VALUES");
writeLine($fp, implode(",\n", $assignRows));
writeLine($fp, "ON DUPLICATE KEY UPDATE `agreed_wage_rate` = VALUES(`agreed_wage_rate`);\n");

// ----------------------------------------------------------------------------
// 17. EXTENSIVE DAILY SITE OPERATIONS ACROSS 4 YEARS (DPR, MANPOWER, EQUIP, CONSUMPTION, WEATHER, ISSUES)
// ----------------------------------------------------------------------------
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 17. EXTENSIVE DAILY SITE OPERATIONS (4-YEAR HISTORICAL LOGS)");
writeLine($fp, "-- ----------------------------------------------------------------------------");

$projectsSchedule = [
    [
        'proj_id' => 101, 'site_id' => 201, 'zone_id' => 301, 'name' => 'KMC hospital',
        'start' => '2023-01-15', 'end' => '2024-03-31', 'status' => 3, 'step_days' => 3,
        'manpower_base' => 48, 'equip_base' => 6,
        'boq_items' => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 75, 76, 77, 78],
        'mat_keys' => [1, 16, 36, 51, 66, 81, 101, 121, 136, 151],
        'activities' => [
            'Site excavation and raft foundation concrete pouring for ICU basement',
            'Reinforcement tying, shuttering and casting of 1st floor columns',
            'Ground floor OPD slab casting (180 cum M25 concrete)',
            '2nd and 3rd floor ICU superstructure RCC framed structure casting',
            'Modular OT antibacterial stainless steel wall panels and oxygen gas conduits',
            'HVAC ducting, electrical riser cable pulling, and acoustic ceiling grid',
            'Anti-bacterial vitrified tile flooring and surgical wash sink fittings',
            'Final medical gas pressure testing, emergency generator commissioning, and hospital handover'
        ]
    ],
    [
        'proj_id' => 102, 'site_id' => 203, 'zone_id' => 307, 'name' => 'Valluvar hotel',
        'start' => '2024-02-01', 'end' => '2025-05-30', 'status' => 3, 'step_days' => 3,
        'manpower_base' => 44, 'equip_base' => 5,
        'boq_items' => [27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 79, 80, 81, 82, 83],
        'mat_keys' => [2, 17, 37, 52, 67, 82, 102, 122, 137, 152],
        'activities' => [
            'Deep basement excavation and soldier pile retaining wall installation',
            'Basement B1 and B2 car parking slab concrete pouring',
            'Ground floor banquet hall grand entrance framing and high ceiling trusses',
            'Floors 1 to 5 guest room reinforced concrete columns and slab casting',
            'Hotel guest room plumbing shafts, acoustic drywall partitions and conduits',
            'Rooftop restaurant glass facade installation and swimming pool waterproofing',
            'Custom woodwork joinery, vitrified Italian marble flooring, and decorative lighting',
            'Full fire fighting hydrants testing, lift commissioning, and final municipal inspection'
        ]
    ],
    [
        'proj_id' => 103, 'site_id' => 205, 'zone_id' => 313, 'name' => 'Bosch Showroom',
        'start' => '2025-06-01', 'end' => '2026-09-30', 'status' => 1, 'step_days' => 3,
        'manpower_base' => 38, 'equip_base' => 4,
        'boq_items' => [46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58],
        'mat_keys' => [3, 18, 38, 53, 68, 83, 103, 123, 138, 153],
        'activities' => [
            'Site leveling, perimeter security fencing, and column footing excavation',
            'Heavy-duty industrial slab concrete casting with metallic hardener topping',
            'Portal steel frame erection, roof purlins and insulated sandwich puff roofing',
            'Customer lounge double-glazed structural curtain wall and frameless glass entry',
            'Workshop 2-post and 4-post hydraulic lift foundation and air compressor piping',
            'Automated paint booth assembly, exhaust ducting, and electrical busbar trunking',
            'Exterior concrete interlock paving, customer car parking, and signage illumination',
            'Service bay epoxy flooring topcoat application and diagnostic test bay calibration'
        ]
    ]
];

$dprId = 1;
$dprProgId = 1;
$dprManpowerId = 1;
$dprEquipId = 1;
$matConsId = 1;
$weatherId = 1;
$issueId = 1;
$visitorId = 1;

$dprRows = [];
$progRows = [];
$mpRows = [];
$eqRows = [];
$consRows = [];
$weatherRows = [];
$issueRows = [];
$visitorRows = [];

foreach ($projectsSchedule as $p) {
    $curr = strtotime($p['start']);
    $end = strtotime($p['end']);
    $totalSteps = ceil(($end - $curr) / (86400 * $p['step_days']));
    $stepIdx = 0;

    while ($curr <= $end) {
        $dateStr = date('Y-m-d', $curr);
        $pctPlanned = min(100.0, round(($stepIdx / $totalSteps) * 100.0, 1));
        
        if ($p['status'] == 3) {
            $pctActual = min(100.0, round($pctPlanned * (0.95 + (rand(0, 10) / 100)), 1));
            if ($curr == $end) {
                $pctActual = 100.0;
                $pctPlanned = 100.0;
            }
        } else {
            $pctActual = min(68.5, round(($pctPlanned * 0.70), 1));
        }

        $actIdx = min(count($p['activities']) - 1, floor(($stepIdx / $totalSteps) * count($p['activities'])));
        $summary = $p['activities'][$actIdx];
        $manpower = $p['manpower_base'] + rand(-4, 6);
        $equip = $p['equip_base'] + rand(-1, 2);
        $repNo = sprintf("DPR-%d-%04d", $p['proj_id'], $dprId);

        $dprRows[] = sprintf(
            "(%d, 1, %d, %d, '%s', '%s', 1, '08:00:00', '17:30:00', 1, 0, %d, %d, %.2f, %.2f, '%s', 'Continue sequential reinforcement and staging inspection with consultant.', 3, 1, '%s 18:00:00', NOW())",
            $dprId, $p['proj_id'], $p['site_id'], $repNo, $dateStr, $manpower, $equip, $pctPlanned, $pctActual, addslashes($summary), $dateStr
        );

        $boqItemId = $p['boq_items'][$stepIdx % count($p['boq_items'])];
        $progRows[] = sprintf(
            "(%d, 1, %d, %d, %d, %d, %d, 3, 'Zone Floor Execution', 150.00, 150.00, 0.00, 150.00, %.2f, 1, 1, '%s 17:00:00', 'M-SHEET-%d', 2, 'Consultant inspected and approved', 1, 1, NOW(), NOW(), NULL)",
            $dprProgId++, 1, $p['proj_id'], $dprId, $boqItemId, $p['site_id'], $p['zone_id'], $pctActual, $dateStr, $dprId
        );

        $mpRows[] = sprintf("(%d, 1, %d, 1, 501, %d, 12, 12, 0, 0, 96.0, 0.0, 1, 'Masonry works', NOW(), NOW())", $dprManpowerId++, $dprId, $p['zone_id']);
        $mpRows[] = sprintf("(%d, 1, %d, 2, 501, %d, 8, 8, 0, 0, 64.0, 0.0, 1, 'Carpentry shuttering', NOW(), NOW())", $dprManpowerId++, $dprId, $p['zone_id']);
        $mpRows[] = sprintf("(%d, 1, %d, 3, 501, %d, 10, 10, 0, 0, 80.0, 0.0, 1, 'Barbending steel rebar', NOW(), NOW())", $dprManpowerId++, $dprId, $p['zone_id']);
        $mpRows[] = sprintf("(%d, 1, %d, 4, 501, %d, 15, 15, 0, 0, 120.0, 0.0, 1, 'General civil helpers', NOW(), NOW())", $dprManpowerId++, $dprId, $p['zone_id']);

        $eqRows[] = sprintf("(%d, 1, %d, %d, 'EQ-01', 'Excavator JCB 3DX', 1, 'Tata Earthmovers', 'Murugan', 1, '08:00:00', '16:00:00', 7.5, 0.5, 0.0, 45.0, 'Ltr', 1000, 1008, 1, 'Earth excavation', NOW(), NOW())", $dprEquipId++, $dprId, $p['zone_id']);
        $eqRows[] = sprintf("(%d, 1, %d, %d, 'EQ-02', 'Concrete Batching Mixer', 1, 'Self Owned', 'Kandasamy', 1, '08:00:00', '17:00:00', 8.0, 1.0, 0.0, 35.0, 'Ltr', 500, 508, 1, 'Concrete mixing', NOW(), NOW())", $dprEquipId++, $dprId, $p['zone_id']);

        $m1 = $p['mat_keys'][$stepIdx % count($p['mat_keys'])];
        $m2 = $p['mat_keys'][($stepIdx + 1) % count($p['mat_keys'])];
        $consRows[] = sprintf("(%d, 1, %d, %d, %d, %d, 1, %d, NULL, 120.00, 120.00, 0.00, 0.00, 395.00, 47400.00, 1, 'Consumed for slab casting', 1, NOW(), NOW())", $matConsId++, 1, $p['proj_id'], $dprId, ($dprProgId - 1), $m1, $p['zone_id']);
        $consRows[] = sprintf("(%d, 1, %d, %d, %d, %d, 2, %d, NULL, 2.50, 2.50, 0.00, 0.00, 68000.00, 170000.00, 1, 'TMT Rebar tied for column staging', 1, NOW(), NOW())", $matConsId++, 1, $p['proj_id'], $dprId, ($dprProgId - 1), $m2, $p['zone_id']);

        $temp = 28.0 + rand(0, 8);
        $weatherRows[] = sprintf("(%d, 1, %d, '12:00:00', 2, 1, %.1f, 65.0, 0.0, 1, 0.0, 'Sunny clear sky, excellent pouring conditions', 1, NOW(), NOW(), NULL)", $weatherId++, $dprId, $temp);

        if ($dprId % 8 == 0) {
            $issueRows[] = sprintf(
                "(%d, 1, %d, %d, 'ISS-%04d', 1, 'Rebar placement clearance check', 'Inspection note resolved on site with structural consultant', 1, 1, 0.0, 1, 2, '%s', '%s', 'Rebar spacing verified and signoff complete', 3, 1, 1, NOW(), NOW(), NULL)",
                $issueId, $dprId, $p['zone_id'], $issueId, $dateStr, $dateStr
            );
            $issueId++;
        }

        if ($dprId % 12 == 0) {
            $visitorRows[] = sprintf(
                "(%d, 1, %d, 'Er. S. Rajendran', 'Karur Municipal Corporation', 'Executive Engineer', '9842419999', 1, 'Routine structural milestone stage inspection', '10:30:00', '12:00:00', 1, 'Site safety protocols and curing verified', 0, NULL, NULL, 1, 1, NOW(), NOW(), NULL)",
                $visitorId++, $dprId
            );
        }

        $dprId++;
        $stepIdx++;
        $curr += 86400 * $p['step_days'];
    }
}

// Write DPRs in chunks
$chunk = 300;
for ($i = 0; $i < count($dprRows); $i += $chunk) {
    writeLine($fp, "INSERT INTO `daily_site_reports` (`id`, `company_id`, `project_id`, `site_id`, `report_no`, `report_date`, `shift_type_id`, `work_start_time`, `work_end_time`, `safety_briefing_done`, `safety_incident_count`, `total_manpower`, `total_equipment`, `planned_progress_percentage`, `actual_progress_percentage`, `overall_work_summary`, `next_day_plan`, `status_id`, `created_by`, `created_at`, `updated_at`) VALUES");
    writeLine($fp, implode(",\n", array_slice($dprRows, $i, $chunk)));
    writeLine($fp, "ON DUPLICATE KEY UPDATE `actual_progress_percentage` = VALUES(`actual_progress_percentage`);\n");
}

for ($i = 0; $i < count($progRows); $i += $chunk) {
    writeLine($fp, "INSERT INTO `daily_work_progress` (`id`, `company_id`, `project_id`, `daily_report_id`, `boq_item_id`, `site_id`, `zone_id`, `uom_id`, `location_description`, `planned_qty_for_day`, `completed_qty_for_day`, `cumulative_qty_before`, `cumulative_qty_after`, `completion_percentage`, `quality_status_id`, `inspected_by`, `inspected_at`, `measurement_reference`, `work_status_id`, `remarks`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at`) VALUES");
    writeLine($fp, implode(",\n", array_slice($progRows, $i, $chunk)));
    writeLine($fp, "ON DUPLICATE KEY UPDATE `completion_percentage` = VALUES(`completion_percentage`);\n");
}

for ($i = 0; $i < count($mpRows); $i += $chunk) {
    writeLine($fp, "INSERT INTO `daily_site_manpower` (`id`, `company_id`, `daily_report_id`, `labour_category_id`, `contractor_id`, `zone_id`, `planned_count`, `present_count`, `absent_count`, `overtime_workers`, `total_regular_hours`, `total_overtime_hours`, `source_type_id`, `work_description`, `created_at`, `updated_at`) VALUES");
    writeLine($fp, implode(",\n", array_slice($mpRows, $i, $chunk)));
    writeLine($fp, "ON DUPLICATE KEY UPDATE `present_count` = VALUES(`present_count`);\n");
}

for ($i = 0; $i < count($eqRows); $i += $chunk) {
    writeLine($fp, "INSERT INTO `daily_site_equipment` (`id`, `company_id`, `daily_report_id`, `zone_id`, `equipment_code`, `equipment_name`, `ownership_type_id`, `supplier_or_owner`, `operator_name`, `quantity`, `start_time`, `end_time`, `working_hours`, `idle_hours`, `breakdown_hours`, `fuel_consumed`, `fuel_uom`, `meter_opening`, `meter_closing`, `status_id`, `work_description`, `created_at`, `updated_at`) VALUES");
    writeLine($fp, implode(",\n", array_slice($eqRows, $i, $chunk)));
    writeLine($fp, "ON DUPLICATE KEY UPDATE `working_hours` = VALUES(`working_hours`);\n");
}

for ($i = 0; $i < count($consRows); $i += $chunk) {
    writeLine($fp, "INSERT INTO `daily_material_consumption` (`id`, `company_id`, `project_id`, `daily_report_id`, `work_progress_id`, `material_id`, `uom_id`, `zone_id`, `stock_transaction_id`, `issued_qty`, `consumed_qty`, `returned_qty`, `wasted_qty`, `unit_rate`, `consumption_value`, `source_type_id`, `remarks`, `created_by`, `created_at`, `updated_at`) VALUES");
    writeLine($fp, implode(",\n", array_slice($consRows, $i, $chunk)));
    writeLine($fp, "ON DUPLICATE KEY UPDATE `consumed_qty` = VALUES(`consumed_qty`);\n");
}

if (!empty($weatherRows)) {
    writeLine($fp, "INSERT INTO `daily_site_weather` (`id`, `company_id`, `daily_report_id`, `observation_time`, `weather_period_id`, `weather_condition_id`, `temperature_c`, `humidity_percentage`, `rainfall_mm`, `work_impact_id`, `lost_hours`, `remarks`, `created_by`, `created_at`, `updated_at`, `deleted_at`) VALUES");
    writeLine($fp, implode(",\n", $weatherRows));
    writeLine($fp, "ON DUPLICATE KEY UPDATE `temperature_c` = VALUES(`temperature_c`);\n");
}

if (!empty($issueRows)) {
    writeLine($fp, "INSERT INTO `daily_site_issues` (`id`, `company_id`, `daily_report_id`, `zone_id`, `issue_no`, `issue_type_id`, `title`, `description`, `priority_id`, `work_impact_id`, `lost_hours`, `reported_by`, `assigned_to`, `target_resolution_date`, `resolved_date`, `resolution`, `status_id`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at`) VALUES");
    writeLine($fp, implode(",\n", $issueRows));
    writeLine($fp, "ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);\n");
}

if (!empty($visitorRows)) {
    writeLine($fp, "INSERT INTO `daily_site_visitors` (`id`, `company_id`, `daily_report_id`, `visitor_name`, `organisation`, `designation`, `phone`, `visit_type_id`, `purpose`, `check_in_time`, `check_out_time`, `hosted_by`, `instructions_or_observations`, `follow_up_required`, `follow_up_owner`, `follow_up_date`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at`) VALUES");
    writeLine($fp, implode(",\n", $visitorRows));
    writeLine($fp, "ON DUPLICATE KEY UPDATE `visitor_name` = VALUES(`visitor_name`);\n");
}

// ----------------------------------------------------------------------------
// 18. LABOUR ATTENDANCE BATCHES & ENTRIES (6,000+ ROWS)
// ----------------------------------------------------------------------------
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 18. EXTENSIVE LABOUR ATTENDANCE BATCHES & ENTRIES");
writeLine($fp, "-- ----------------------------------------------------------------------------");

$batchId = 1;
$entryId = 1;
$batchRows = [];
$entryRows = [];

$allMonths = [];
for ($yr = 2023; $yr <= 2026; $yr++) {
    $maxM = ($yr == 2026) ? 9 : 12;
    for ($m = 1; $m <= $maxM; $m++) {
        if ($yr == 2023 || ($yr == 2024 && $m <= 3)) {
            $pId = 101; $sId = 201;
        } elseif (($yr == 2024 && $m >= 2) || ($yr == 2025 && $m <= 5)) {
            $pId = 102; $sId = 203;
        } else {
            $pId = 103; $sId = 205;
        }
        $allMonths[] = ['proj_id' => $pId, 'site_id' => $sId, 'year' => $yr, 'month' => $m];
    }
}

foreach ($allMonths as $am) {
    for ($d = 1; $d <= 16; $d += 2) {
        $attDate = sprintf("%04d-%02d-%02d", $am['year'], $am['month'], $d);
        $totalWorkers = 15;
        $presentWorkers = 13;
        $absentWorkers = 2;
        $regHours = 13 * 8.0;
        $otHours = 12.0;

        $batchRows[] = sprintf(
            "(%d, 1, %d, %d, '%s', 'GENERAL', 1, '%s 18:00:00', 1, '%s 18:00:00', 3, %d, %d, %d, %.2f, %.2f, 'Approved site attendance batch.', 1, 1, '%s 18:00:00', NOW())",
            $batchId, $am['proj_id'], $am['site_id'], $attDate, $attDate, $attDate, $totalWorkers, $presentWorkers, $absentWorkers, $regHours, $otHours, $attDate
        );

        for ($w = 1; $w <= 15; $w++) {
            $assignId = ($am['proj_id'] * 100) + $w;
            $status = (rand(1, 10) > 1) ? 1 : 2;
            $regH = ($status == 1) ? 8.0 : 0.0;
            $ot = ($status == 1 && ($w % 3 == 0)) ? 2.0 : 0.0;
            $entryRows[] = sprintf(
                "(%d, 1, %d, %d, %d, NULL, %d, '08:00:00', '17:00:00', %.2f, %.2f, 'Site civil masonry and staging work', 1, NULL, NULL, NULL, NULL, 1, 1, '%s 18:00:00', NOW())",
                $entryId++, $batchId, $assignId, $w, $status, $regH, $ot, $attDate
            );
        }
        $batchId++;
    }
}

$chunk = 300;
for ($i = 0; $i < count($batchRows); $i += $chunk) {
    writeLine($fp, "INSERT INTO `labour_attendance_batches` (`id`, `company_id`, `project_id`, `site_id`, `attendance_date`, `shift_code`, `prepared_by`, `prepared_at`, `approved_by`, `approved_at`, `status_id`, `total_workers`, `present_workers`, `absent_workers`, `total_regular_hours`, `total_overtime_hours`, `remarks`, `created_by`, `updated_by`, `created_at`, `updated_at`) VALUES");
    writeLine($fp, implode(",\n", array_slice($batchRows, $i, $chunk)));
    writeLine($fp, "ON DUPLICATE KEY UPDATE `attendance_date` = VALUES(`attendance_date`), `status_id` = VALUES(`status_id`);\n");
}

for ($i = 0; $i < count($entryRows); $i += $chunk) {
    writeLine($fp, "INSERT INTO `labour_attendance_entries` (`id`, `company_id`, `batch_id`, `assignment_id`, `worker_id`, `zone_id`, `attendance_status_id`, `check_in_time`, `check_out_time`, `regular_hours`, `overtime_hours`, `work_description`, `attendance_source_id`, `latitude`, `longitude`, `selfie_path`, `remarks`, `created_by`, `updated_by`, `created_at`, `updated_at`) VALUES");
    writeLine($fp, implode(",\n", array_slice($entryRows, $i, $chunk)));
    writeLine($fp, "ON DUPLICATE KEY UPDATE `attendance_status_id` = VALUES(`attendance_status_id`);\n");
}

// ----------------------------------------------------------------------------
// 19. EXPENSES, BILLS, ALERTS & MANAGEMENT REVIEWS
// ----------------------------------------------------------------------------
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 19. PROJECT EXPENSES & ACCOUNTS");
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "INSERT INTO `expense_categories` (`id`, `company_id`, `category_code`, `category_name`, `is_active`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1, 1, 'EXP-CAT-FUEL', 'Fuel & Generator Diesel Expenses', 1, '2023-01-01', NOW()),");
writeLine($fp, "(2, 1, 'EXP-CAT-TEST', 'Soil, Concrete & Steel Testing Laboratory Fees', 1, '2023-01-01', NOW()),");
writeLine($fp, "(3, 1, 'EXP-CAT-SAFE', 'Site Safety Gear, Helmets, Boots & First Aid', 1, '2023-01-01', NOW()),");
writeLine($fp, "(4, 1, 'EXP-CAT-OFFC', 'Site Office Utilities, Internet & Administration', 1, '2023-01-01', NOW()),");
writeLine($fp, "(5, 1, 'EXP-CAT-STAT', 'Statutory Approvals, Municipal & TNEB Inspection Fees', 1, '2023-01-01', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `category_name` = VALUES(`category_name`);\n");

writeLine($fp, "INSERT INTO `expense_bills` (`id`, `company_id`, `project_id`, `bill_no`, `internal_voucher_no`, `bill_date`, `payee_type_id`, `payee_name`, `subtotal`, `taxable_amount`, `cgst_amount`, `sgst_amount`, `gross_amount`, `net_payable`, `paid_amount`, `outstanding_amount`, `payment_status_id`, `status_id`, `created_by`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1101, 1, 101, 'BILL-KMC-2023-01', 'EXP-KMC-001', '2023-03-15', 1, 'Karur City Fuel Station', 185000.00, 185000.00, 0.00, 0.00, 185000.00, 185000.00, 185000.00, 0.00, 2, 2, 1, '2023-03-15', NOW()),");
writeLine($fp, "(1102, 1, 101, 'BILL-KMC-2023-02', 'EXP-KMC-002', '2023-08-20', 1, 'Civil Quality Testing Lab Trichy', 95000.00, 95000.00, 8550.00, 8550.00, 112100.00, 112100.00, 112100.00, 0.00, 2, 2, 1, '2023-08-20', NOW()),");
writeLine($fp, "(1103, 1, 102, 'BILL-VAL-2024-01', 'EXP-VAL-001', '2024-04-10', 1, 'Kongu Diesel & Lubricants', 240000.00, 240000.00, 0.00, 0.00, 240000.00, 240000.00, 240000.00, 0.00, 2, 2, 1, '2024-04-10', NOW()),");
writeLine($fp, "(1104, 1, 102, 'BILL-VAL-2024-02', 'EXP-VAL-002', '2024-10-15', 1, 'TNEB Power Sanction & Transformer Inspection', 350000.00, 350000.00, 0.00, 0.00, 350000.00, 350000.00, 350000.00, 0.00, 2, 2, 1, '2024-10-15', NOW()),");
writeLine($fp, "(1105, 1, 103, 'BILL-BSH-2025-01', 'EXP-BSH-001', '2025-07-15', 1, 'Safety Solutions Industrial Karur', 85000.00, 85000.00, 7650.00, 7650.00, 100300.00, 100300.00, 100300.00, 0.00, 2, 2, 1, '2025-07-15', NOW()),");
writeLine($fp, "(1106, 1, 103, 'BILL-BSH-2026-02', 'EXP-BSH-002', '2026-02-20', 1, 'Industrial Flooring Testing & Inspection Agency', 65000.00, 65000.00, 5850.00, 5850.00, 76700.00, 76700.00, 76700.00, 0.00, 2, 2, 1, '2026-02-20', NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `gross_amount` = VALUES(`gross_amount`);\n");

writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "-- 20. DASHBOARD ALERTS & MANAGEMENT REVIEWS");
writeLine($fp, "-- ----------------------------------------------------------------------------");
writeLine($fp, "INSERT INTO `dashboard_alerts` (`id`, `company_id`, `project_id`, `alert_no`, `alert_type_id`, `severity_id`, `title`, `message`, `source_module`, `alert_date`, `due_date`, `status_id`, `created_by`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1201, 1, 101, 'ALT-KMC-001', 1, 2, 'KMC Hospital ICU Final Medical Gas Audit', 'Completed: Medical gas pipeline pressure testing certified with 100% signoff.', 'MEP_OPERATIONS', '2024-03-20', '2024-03-25', 4, 1, '2024-03-20', NOW()),");
writeLine($fp, "(1202, 1, 102, 'ALT-VAL-002', 2, 1, 'Valluvar Hotel Banquet HVAC Fire Safety Certificate', 'Completed: Fire safety and ventilation clearance certificate received from Karur authority.', 'SCHEDULE', '2025-05-15', '2025-05-20', 4, 1, '2025-05-15', NOW()),");
writeLine($fp, "(1203, 1, 103, 'ALT-BSH-003', 1, 2, 'Bosch Showroom Glass Glazing Structural Signoff', 'Active: Toughened curtain wall sealant bonding inspection scheduled for tomorrow.', 'QUALITY', NOW(), DATE_ADD(CURRENT_DATE(), INTERVAL 2 DAY), 1, 1, NOW(), NOW()),");
writeLine($fp, "(1204, 1, 104, 'ALT-CHT-004', 3, 3, 'Chettinad College Foundation Soil Bearing Capacity Review', 'Planned: Third-party geotechnical borehole test report review before foundation start.', 'ENGINEERING', NOW(), DATE_ADD(CURRENT_DATE(), INTERVAL 10 DAY), 1, 1, NOW(), NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `status_id` = VALUES(`status_id`);\n");

writeLine($fp, "INSERT INTO `management_review_notes` (`id`, `company_id`, `project_id`, `review_date`, `review_type_id`, `priority_id`, `subject`, `observations`, `decisions`, `action_required`, `status_id`, `created_by`, `created_at`, `updated_at`) VALUES");
writeLine($fp, "(1301, 1, 101, '2024-03-28', 1, 1, 'KMC Hospital Final Project Completion & Handover Review', 'All 250 hospital beds, ICU facilities, and modular operation theatres fully completed and certified.', 'Approve final milestone release and contractor performance certificate.', 'Handover keys to Hospital Trustees.', 3, 1, '2024-03-28', NOW()),");
writeLine($fp, "(1302, 1, 102, '2025-05-25', 1, 1, 'Valluvar Hotel Grand Opening Readiness Review', 'Hotel guest rooms, banquet auditorium and multi-level parking completed within approved budget.', 'Authorize commercial operations and grand opening.', 'Final audit settlement approved.', 3, 1, '2025-05-25', NOW()),");
writeLine($fp, "(1303, 1, 103, CURRENT_DATE(), 1, 1, 'Bosch Showroom 68.5% Progress Milestone Review', 'Showroom glass facade and service bay flooring completed. Final painting and lighting in progress.', 'Expedite paint booth electrical connection with TNEB.', 'Site Engineer to inspect epoxy curing.', 1, 1, NOW(), NOW()),");
writeLine($fp, "(1304, 1, 104, CURRENT_DATE(), 1, 2, 'Chettinad College Puliyur Campus Preliminary Planning Review', 'Master architectural drawings, BOQ sections, and statutory approval package prepared.', 'Authorize contractor pre-qualification bidding.', 'Issue tender documents for civil package.', 1, 1, NOW(), NOW())");
writeLine($fp, "ON DUPLICATE KEY UPDATE `subject` = VALUES(`subject`);\n");

writeLine($fp, "SET FOREIGN_KEY_CHECKS = 1;\n");
writeLine($fp, "-- END OF EXTENSIVE 4-YEAR CIVIL DESK ERP DEMO SEED DATASET\n");

fclose($fp);

$lineCount = count(file($outputFile));
echo "Successfully generated schema-aligned demo seed SQL file at: $outputFile\n";
echo "Total Line Count: $lineCount lines\n";
