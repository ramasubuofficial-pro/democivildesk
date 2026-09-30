<?php

declare(strict_types=1);

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;
use Throwable;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->db->transException(true);
        $this->db->transStart();

        try {
            $companyId = 1;
            $branchId = 1;
            $userId = 1;
            $now = date('Y-m-d H:i:s');
            $today = date('Y-m-d');

            // 0. Ensure Company & Branch exist
            $company = $this->db->table('companies')->where('id', $companyId)->get()->getRowArray();
            if ($company === null) {
                $this->db->table('companies')->insert([
                    'id' => 1,
                    'company_code' => 'CMP-001',
                    'company_name' => 'CivilDesk Constructions Pvt Ltd',
                    'legal_name' => 'CivilDesk ERP Demo Pvt Ltd',
                    'email' => 'admin@civildesk.in',
                    'phone' => '9842411111',
                    'is_active' => 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            $branch = $this->db->table('branches')->where('id', $branchId)->get()->getRowArray();
            if ($branch === null) {
                $this->db->table('branches')->insert([
                    'id' => 1,
                    'company_id' => $companyId,
                    'branch_code' => 'BR-KRR-01',
                    'branch_name' => 'Karur Main Branch',
                    'email' => 'karur@civildesk.in',
                    'phone' => '9842411112',
                    'is_head_office' => 1,
                    'is_active' => 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            // 0.1 Ensure SuperAdmin exists
            $user = $this->db->table('users')->where('email', 'superadmin@civilpro.com')->get()->getRowArray();
            if ($user === null) {
                $passwordHash = '$2y$12$Aaq0T/K6qKGbORyKyVXJWePjPQV6DYdS0gU53L.4/QQOb4np2PKlq'; // Admin@12345
                $this->db->table('users')->insert([
                    'id' => 1,
                    'company_id' => $companyId,
                    'default_branch_id' => $branchId,
                    'username' => 'superadmin',
                    'email' => 'superadmin@civilpro.com',
                    'password_hash' => $passwordHash,
                    'first_name' => 'Super',
                    'last_name' => 'Administrator',
                    'designation' => 'System Administrator',
                    'user_type_id' => 1,
                    'user_status_id' => 1,
                    'active' => 1,
                    'is_super_admin' => 1,
                    'is_active' => 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $this->db->table('auth_identities')->insert([
                    'user_id' => 1,
                    'type' => 'email_password',
                    'secret' => 'superadmin@civilpro.com',
                    'secret2' => $passwordHash,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            // 1. Ensure Financial Year exists
            $fy = $this->db->table('financial_years')
                ->where('company_id', $companyId)
                ->where('is_active', 1)
                ->where('deleted_at', null)
                ->get()->getRowArray();
            if ($fy === null) {
                $this->db->table('financial_years')->insert([
                    'company_id' => $companyId,
                    'year_code' => 'FY-2026-27',
                    'year_name' => 'Financial Year 2026-2027',
                    'start_date' => '2026-04-01',
                    'end_date' => '2027-03-31',
                    'is_current' => 1,
                    'is_active' => 1,
                    'created_by' => $userId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $fyId = (int) $this->db->insertID();
            } else {
                $fyId = (int) $fy['id'];
            }

            // 2. Ensure Primary Client exists
            $client = $this->db->table('clients')
                ->where('company_id', $companyId)
                ->where('deleted_at', null)
                ->get()->getRowArray();
            if ($client === null) {
                $this->db->table('clients')->insert([
                    'company_id' => $companyId,
                    'client_code' => 'CLI-KRR-001',
                    'client_name' => 'Karur Infrastructure & City Builders',
                    'contact_person' => 'Ramasamy N',
                    'email' => 'contact@karurbuilders.com',
                    'phone' => '9842412345',
                    'pan_number' => 'ABCDE1234F',
                    'gstin' => '33ABCDE1234F1Z5',
                    'status_id' => 1,
                    'is_active' => 1,
                    'created_by' => $userId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $clientId = (int) $this->db->insertID();
            } else {
                $clientId = (int) $client['id'];
            }

            // 3. Ensure Project Type exists
            $projectType = $this->db->table('project_types')
                ->where('company_id', $companyId)
                ->where('deleted_at', null)
                ->get()->getRowArray();
            if ($projectType === null) {
                $this->db->table('project_types')->insert([
                    'company_id' => $companyId,
                    'type_code' => 'COMMERCIAL',
                    'type_name' => 'Commercial & Institutional Construction',
                    'is_active' => 1,
                    'created_by' => $userId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $projectTypeId = (int) $this->db->insertID();
            } else {
                $projectTypeId = (int) $projectType['id'];
            }

            // Helper to get master ID safely
            $getMasterId = function(string $table, string $codeCol, string $codeVal, int $default = 1): int {
                $row = $this->db->table($table)->where($codeCol, $codeVal)->get()->getRowArray();
                return $row ? (int)$row['id'] : $default;
            };

            $projStatusOngoing = $getMasterId('projects_status_masters', 'status_code', 'IN_PROGRESS', 1);
            $projPriorityHigh = $getMasterId('projects_priority_masters', 'priority_code', 'HIGH', 1);

            // ==========================================
            // 4. 4 KARUR DEMO PROJECTS
            // ==========================================
            $demoProjects = [
                [
                    'code' => 'PRJ-KRR-001',
                    'name' => 'KMC hospital',
                    'desc' => 'Multi-Speciality 250-bed hospital expansion with modern ICU, modular operation theatres, and diagnostics wing in Gandhigramam, Karur.',
                    'start' => '2026-01-10',
                    'end' => '2026-12-31',
                    'contract_val' => 14500000.00,
                    'budget' => 9500000.00,
                    'planned_pct' => 65.00,
                    'actual_pct' => 68.00,
                ],
                [
                    'code' => 'PRJ-KRR-002',
                    'name' => 'Valluvar hotel',
                    'desc' => 'Premium 4-Star luxury hotel, banquet complex, multi-level car parking, and rooftop restaurant on Kovai Main Road, Karur.',
                    'start' => '2026-02-01',
                    'end' => '2027-02-28',
                    'contract_val' => 18000000.00,
                    'budget' => 12000000.00,
                    'planned_pct' => 45.00,
                    'actual_pct' => 42.00,
                ],
                [
                    'code' => 'PRJ-KRR-003',
                    'name' => 'Bosch Showroom',
                    'desc' => 'Modern Bosch automotive sales showroom, interactive customer gallery, automated service bays, and bodyshop on Karur Bypass Road.',
                    'start' => '2026-03-01',
                    'end' => '2026-11-30',
                    'contract_val' => 8500000.00,
                    'budget' => 6000000.00,
                    'planned_pct' => 50.00,
                    'actual_pct' => 54.00,
                ],
                [
                    'code' => 'PRJ-KRR-004',
                    'name' => 'Chettinad college',
                    'desc' => 'Integrated engineering and arts college academic block, central digital library, smart laboratories, and student hostel campus in Puliyur, Karur.',
                    'start' => '2026-04-01',
                    'end' => '2026-12-20',
                    'contract_val' => 11000000.00,
                    'budget' => 7500000.00,
                    'planned_pct' => 28.00,
                    'actual_pct' => 30.00,
                ],
            ];

            $createdProjectIds = [];

            foreach ($demoProjects as $dp) {
                $existing = $this->db->table('projects')
                    ->where('company_id', $companyId)
                    ->groupStart()
                        ->where('project_code', $dp['code'])
                        ->orWhere('project_name', $dp['name'])
                    ->groupEnd()
                    ->where('deleted_at', null)
                    ->get()->getRowArray();

                if ($existing !== null) {
                    $pId = (int) $existing['id'];
                    $this->db->table('projects')->where('id', $pId)->update([
                        'project_code' => $dp['code'],
                        'project_name' => $dp['name'],
                        'description' => $dp['desc'],
                        'contract_value' => $dp['contract_val'],
                        'estimated_cost' => $dp['budget'],
                        'planned_start_date' => $dp['start'],
                        'expected_completion_date' => $dp['end'],
                        'updated_at' => $now,
                    ]);
                } else {
                    $this->db->table('projects')->insert([
                        'company_id' => $companyId,
                        'branch_id' => $branchId,
                        'client_id' => $clientId,
                        'project_type_id' => $projectTypeId,
                        'financial_year_id' => $fyId,
                        'project_code' => $dp['code'],
                        'project_name' => $dp['name'],
                        'description' => $dp['desc'],
                        'work_order_no' => 'WO-CLI-' . substr($dp['code'], 4),
                        'work_order_date' => $dp['start'],
                        'contract_value' => $dp['contract_val'],
                        'estimated_cost' => $dp['budget'],
                        'planned_start_date' => $dp['start'],
                        'expected_completion_date' => $dp['end'],
                        'project_status_id' => $projStatusOngoing,
                        'priority_id' => $projPriorityHigh,
                        'is_active' => 1,
                        'created_by' => $userId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                    $pId = (int) $this->db->insertID();
                }

                $createdProjectIds[$dp['code']] = [
                    'id' => $pId,
                    'data' => $dp
                ];
            }

            // =========================================================================
            // 5. SITES (MINIMUM 2 PER PROJECT) & ZONES (MINIMUM 3 PER SITE)
            // =========================================================================
            $demoSites = [
                // 1. KMC hospital
                'PRJ-KRR-001' => [
                    [
                        'code' => 'STE-KMC-01',
                        'name' => 'KMC Inpatient & ICU Block (Gandhigramam)',
                        'address' => 'Gandhigramam South, Karur - 639004',
                        'zones' => [
                            ['code' => 'ZON-KMC-01', 'name' => 'OPD & Emergency Ground Floor', 'loc' => 'Emergency Triage & Trauma Bays'],
                            ['code' => 'ZON-KMC-02', 'name' => 'ICU & Modular Operation Theatres', 'loc' => 'OT Complex 1-4 & Recovery Ward'],
                            ['code' => 'ZON-KMC-03', 'name' => 'Diagnostic & Radiology Basement', 'loc' => 'MRI, CT-Scan & X-Ray Radiation Bunker'],
                        ],
                    ],
                    [
                        'code' => 'STE-KMC-02',
                        'name' => 'KMC Doctors Quarters & Pharmacy Wing (Kovai Road)',
                        'address' => 'Near Light House Corner, Kovai Road, Karur',
                        'zones' => [
                            ['code' => 'ZON-KMC-04', 'name' => 'Foundation & Substructure Basement', 'loc' => 'Retaining Wall & Deep Pile Caps'],
                            ['code' => 'ZON-KMC-05', 'name' => 'Doctors Residential Suites Floors 1-4', 'loc' => 'Apartment Units 101 to 408'],
                            ['code' => 'ZON-KMC-06', 'name' => 'Central Pharmacy & Cold Storage', 'loc' => 'Automated Drug Distribution Bay'],
                        ],
                    ],
                ],

                // 2. Valluvar hotel
                'PRJ-KRR-002' => [
                    [
                        'code' => 'STE-VAL-01',
                        'name' => 'Valluvar Grand Hotel Block (Kovai Main Road)',
                        'address' => 'Kovai Main Road, Karur - 639002',
                        'zones' => [
                            ['code' => 'ZON-VAL-01', 'name' => 'Grand Banquet & Reception Lobby', 'loc' => 'Double Height Entrance & Hall A'],
                            ['code' => 'ZON-VAL-02', 'name' => 'Executive Guest Suites Floors 1-6', 'loc' => 'Rooms 101 to 620 Corridors'],
                            ['code' => 'ZON-VAL-03', 'name' => 'Rooftop Infinity Pool & Sky Lounge', 'loc' => 'Pool Deck, Barbecue & Service Bar'],
                        ],
                    ],
                    [
                        'code' => 'STE-VAL-02',
                        'name' => 'Valluvar Convention Center & Multi-Level Parking',
                        'address' => 'Thanthonimalai Bypass Junction, Karur',
                        'zones' => [
                            ['code' => 'ZON-VAL-04', 'name' => 'Convention Auditorium Superstructure', 'loc' => '1500-Seater Pillarless Main Hall'],
                            ['code' => 'ZON-VAL-05', 'name' => 'Multi-Level Basement Car Parking', 'loc' => 'Basement 1 & 2 Ramp & Sensor Parking'],
                            ['code' => 'ZON-VAL-06', 'name' => 'Commercial Kitchen & Catering Facility', 'loc' => 'Industrial Cooking & Cold Rooms'],
                        ],
                    ],
                ],

                // 3. Bosch Showroom
                'PRJ-KRR-003' => [
                    [
                        'code' => 'STE-BSH-01',
                        'name' => 'Bosch Sales & Experience Center (Karur Bypass)',
                        'address' => 'Karur Bypass Road, Near Amaravathi Bridge, Karur',
                        'zones' => [
                            ['code' => 'ZON-BSH-01', 'name' => 'Main Product Display & Customer Lounge', 'loc' => 'Front Glazing & Premium Display Arena'],
                            ['code' => 'ZON-BSH-02', 'name' => 'Delivery Bay & Accessories Showcase', 'loc' => 'Handover Bay 1-2 & Sound Showcase'],
                            ['code' => 'ZON-BSH-03', 'name' => 'Administrative Offices & Billing Counter', 'loc' => 'Conference Room & Sales Executive Cabins'],
                        ],
                    ],
                    [
                        'code' => 'STE-BSH-02',
                        'name' => 'Bosch Express Service & Bodyshop (Vengamedu)',
                        'address' => 'Industrial Estate Road, Vengamedu, Karur',
                        'zones' => [
                            ['code' => 'ZON-BSH-04', 'name' => 'Mechanical Service Bays 1-8', 'loc' => 'Two-Post Hydraulic Lifts Bay 1-8'],
                            ['code' => 'ZON-BSH-05', 'name' => 'Automated Paint Booth & Body Repair', 'loc' => 'Dust-Free Spray Oven & Frame Aligner'],
                            ['code' => 'ZON-BSH-06', 'name' => 'OEM Spare Parts Warehouse', 'loc' => 'Heavy Duty Multi-Tier Storage Racks'],
                        ],
                    ],
                ],

                // 4. Chettinad college
                'PRJ-KRR-004' => [
                    [
                        'code' => 'STE-CHT-01',
                        'name' => 'Chettinad Academic & Laboratory Complex (Puliyur)',
                        'address' => 'Chettinad Campus, Trichy-Karur Main Road, Puliyur',
                        'zones' => [
                            ['code' => 'ZON-CHT-01', 'name' => 'Smart Classrooms & Lecture Halls Wing A', 'loc' => 'Amphitheatre Classrooms 101-115'],
                            ['code' => 'ZON-CHT-02', 'name' => 'Engineering & AI Computer Labs Wing B', 'loc' => 'Robotics & High-End Server Labs'],
                            ['code' => 'ZON-CHT-03', 'name' => 'Central Digital Library & Seminar Hall', 'loc' => 'Reading Hall & 500-Seater Audio Hall'],
                        ],
                    ],
                    [
                        'code' => 'STE-CHT-02',
                        'name' => 'Chettinad Student Hostel & Sports Stadium',
                        'address' => 'North Campus Green Boulevard, Puliyur, Karur',
                        'zones' => [
                            ['code' => 'ZON-CHT-04', 'name' => 'Boys Hostel Residential Block', 'loc' => '4-Storey Hostel Block Rooms 1-120'],
                            ['code' => 'ZON-CHT-05', 'name' => 'Girls Hostel Residential Block', 'loc' => '4-Storey Hostel Block Rooms 1-120'],
                            ['code' => 'ZON-CHT-06', 'name' => 'Indoor Sports Stadium & Dining Hall', 'loc' => 'Badminton Arena & 600-Capacity Mess'],
                        ],
                    ],
                ],
            ];

            $siteStatusActive = $getMasterId('project_sites_status_masters', 'status_code', 'ACTIVE', 1);
            $createdSiteIds = [];

            foreach ($demoSites as $prjCode => $sites) {
                $pId = $createdProjectIds[$prjCode]['id'];

                foreach ($sites as $st) {
                    $existingSite = $this->db->table('project_sites')
                        ->where('company_id', $companyId)
                        ->where('project_id', $pId)
                        ->where('site_code', $st['code'])
                        ->where('deleted_at', null)
                        ->get()->getRowArray();

                    if ($existingSite !== null) {
                        $sId = (int) $existingSite['id'];
                        $this->db->table('project_sites')->where('id', $sId)->update([
                            'site_name' => $st['name'],
                            'location_address' => $st['address'],
                            'updated_at' => $now,
                        ]);
                    } else {
                        $this->db->table('project_sites')->insert([
                            'company_id' => $companyId,
                            'project_id' => $pId,
                            'site_code' => $st['code'],
                            'site_name' => $st['name'],
                            'location_address' => $st['address'],
                            'status_id' => $siteStatusActive,
                            'is_active' => 1,
                            'created_by' => $userId,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]);
                        $sId = (int) $this->db->insertID();
                    }

                    $createdSiteIds[$st['code']] = $sId;

                    // Insert Minimum 3 Zones per Site
                    foreach ($st['zones'] as $z) {
                        $existZone = $this->db->table('site_work_zones')
                            ->where('company_id', $companyId)
                            ->where('site_id', $sId)
                            ->where('zone_code', $z['code'])
                            ->where('deleted_at', null)
                            ->get()->getRowArray();

                        if ($existZone === null) {
                            $this->db->table('site_work_zones')->insert([
                                'company_id' => $companyId,
                                'project_id' => $pId,
                                'site_id' => $sId,
                                'zone_code' => $z['code'],
                                'zone_name' => $z['name'],
                                'is_active' => 1,
                                'created_by' => $userId,
                                'created_at' => $now,
                                'updated_at' => $now,
                            ]);
                            $zoneId = (int) $this->db->insertID();
                        } else {
                            $zoneId = (int) $existZone['id'];
                        }

                        // Insert Work Location for this Zone
                        $locCode = $z['code'] . '-LOC1';
                        $existLoc = $this->db->table('work_locations')
                            ->where('company_id', $companyId)
                            ->where('site_id', $sId)
                            ->where('location_code', $locCode)
                            ->where('deleted_at', null)
                            ->get()->getRowArray();

                        if ($existLoc === null) {
                            $this->db->table('work_locations')->insert([
                                'company_id' => $companyId,
                                'project_id' => $pId,
                                'site_id' => $sId,
                                'work_zone_id' => $zoneId,
                                'location_code' => $locCode,
                                'location_name' => $z['loc'],
                                'is_active' => 1,
                                'created_by' => $userId,
                                'created_at' => $now,
                                'updated_at' => $now,
                            ]);
                        }
                    }
                }
            }

            // ==========================================
            // 6. CONTRACTORS (KARUR REGIONAL SUBCONTRACTORS)
            // ==========================================
            $demoContractors = [
                ['code' => 'CON-KRR-01', 'name' => 'Kongu RMC & Concrete Works Karur', 'contact' => 'Senthil Kumar M', 'phone' => '9842411223'],
                ['code' => 'CON-KRR-02', 'name' => 'Amaravathi Electricals & MEP Karur', 'contact' => 'Vigneshwaran P', 'phone' => '9842422334'],
                ['code' => 'CON-KRR-03', 'name' => 'Cauvery TMT & Rebar Fabricators', 'contact' => 'Mani Balan S', 'phone' => '9842433445'],
                ['code' => 'CON-KRR-04', 'name' => 'Karur City Infrastructure Earthmovers', 'contact' => 'Thangavel K', 'phone' => '9842444556'],
            ];

            $contractorStatusActive = $getMasterId('subcontractors_status_masters', 'status_code', 'ACTIVE', 1);
            $contractorTypeGeneral = $getMasterId('subcontractors_contractor_type_masters', 'contractor_type_code', 'CIVIL', 1);
            $createdContractorIds = [];

            foreach ($demoContractors as $c) {
                $existC = $this->db->table('subcontractors')
                    ->where('company_id', $companyId)
                    ->where('contractor_code', $c['code'])
                    ->where('deleted_at', null)
                    ->get()->getRowArray();

                if ($existC !== null) {
                    $cId = (int) $existC['id'];
                } else {
                    $this->db->table('subcontractors')->insert([
                        'company_id' => $companyId,
                        'contractor_code' => $c['code'],
                        'contractor_name' => $c['name'],
                        'contractor_type_id' => $contractorTypeGeneral,
                        'contact_person' => $c['contact'],
                        'phone' => $c['phone'],
                        'email' => strtolower(str_replace(' ', '', $c['contact'])) . '@karurcontractors.com',
                        'pan_number' => 'ABCDE' . rand(1000, 9999) . 'Z',
                        'gstin' => '33ABCDE' . rand(1000, 9999) . 'Z1Z5',
                        'status_id' => $contractorStatusActive,
                        'is_active' => 1,
                        'created_by' => $userId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                    $cId = (int) $this->db->insertID();
                }

                $createdContractorIds[$c['code']] = $cId;
            }

            // ==========================================
            // 7. LABOUR CONTRACTORS & ATTENDANCE
            // ==========================================
            $demoLabourContractors = [
                ['code' => 'LC-KRR-01', 'name' => 'Sri Balaji Labour Suppliers Karur', 'contact' => 'Manickam P', 'phone' => '9944011223'],
                ['code' => 'LC-KRR-02', 'name' => 'Pasupatheeswarar Construction Manpower', 'contact' => 'Gunasekaran K', 'phone' => '9944022334'],
            ];

            $lcStatusActive = $getMasterId('labour_contractors_status_masters', 'status_code', 'ACTIVE', 1);
            foreach ($demoLabourContractors as $lc) {
                $existLc = $this->db->table('labour_contractors')
                    ->where('company_id', $companyId)
                    ->where('contractor_code', $lc['code'])
                    ->where('deleted_at', null)
                    ->get()->getRowArray();

                if ($existLc === null) {
                    $this->db->table('labour_contractors')->insert([
                        'company_id' => $companyId,
                        'contractor_code' => $lc['code'],
                        'contractor_name' => $lc['name'],
                        'contact_person' => $lc['contact'],
                        'phone' => $lc['phone'],
                        'status_id' => $lcStatusActive,
                        'is_active' => 1,
                        'created_by' => $userId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            $batchStatusApproved = $getMasterId('labour_attendance_batches_status_masters', 'status_code', 'APPROVED', 2);
            foreach ($createdProjectIds as $code => $pInfo) {
                $pId = $pInfo['id'];
                $batchNo = 'ATT-KRR-' . substr($code, 8);

                $existBatch = $this->db->table('labour_attendance_batches')
                    ->where('company_id', $companyId)
                    ->where('project_id', $pId)
                    ->where('batch_no', $batchNo)
                    ->where('deleted_at', null)
                    ->get()->getRowArray();

                if ($existBatch === null) {
                    $this->db->table('labour_attendance_batches')->insert([
                        'company_id' => $companyId,
                        'project_id' => $pId,
                        'batch_no' => $batchNo,
                        'attendance_date' => $today,
                        'status_id' => $batchStatusApproved,
                        'total_workers' => rand(25, 45),
                        'total_regular_hours' => 240.0,
                        'total_overtime_hours' => 20.0,
                        'total_wage_amount' => 22500.00,
                        'created_by' => $userId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            // ==========================================
            // 8. WORKS (SUBCONTRACT WORK ORDERS)
            // ==========================================
            $demoWorkOrders = [
                [
                    'prj' => 'PRJ-KRR-001',
                    'contractor' => 'CON-KRR-01',
                    'wo_no' => 'WO-KMC-001-RCC',
                    'date' => '2026-01-20',
                    'scope' => 'Hospital ICU & OT structural RCC concrete framework, shear wall casting, and medical gas line sleeve conduits.',
                    'val' => 4200000.00,
                    'paid' => 1650000.00,
                ],
                [
                    'prj' => 'PRJ-KRR-002',
                    'contractor' => 'CON-KRR-02',
                    'wo_no' => 'WO-VAL-002-MEP',
                    'date' => '2026-02-15',
                    'scope' => 'Hotel guest rooms centralized VRV HVAC ducting, plumbing lines, and banquet decorative lighting.',
                    'val' => 4800000.00,
                    'paid' => 1950000.00,
                ],
                [
                    'prj' => 'PRJ-KRR-003',
                    'contractor' => 'CON-KRR-03',
                    'wo_no' => 'WO-BSH-003-STEEL',
                    'date' => '2026-03-10',
                    'scope' => 'Showroom portal steel frame fabrication, structural glass curtain wall, and workshop gantry crane rails.',
                    'val' => 2500000.00,
                    'paid' => 1100000.00,
                ],
                [
                    'prj' => 'PRJ-KRR-004',
                    'contractor' => 'CON-KRR-04',
                    'wo_no' => 'WO-CHT-004-CIVIL',
                    'date' => '2026-04-10',
                    'scope' => 'Academic block raft foundation earthwork excavation, campus internal CC roads, and storm water drains.',
                    'val' => 3100000.00,
                    'paid' => 850000.00,
                ],
            ];

            $woStatusApproved = $getMasterId('subcontract_work_orders_status_masters', 'status_code', 'APPROVED', 1);
            foreach ($demoWorkOrders as $wo) {
                $pId = $createdProjectIds[$wo['prj']]['id'];
                $cId = $createdContractorIds[$wo['contractor']];

                $existWo = $this->db->table('subcontract_work_orders')
                    ->where('company_id', $companyId)
                    ->where('project_id', $pId)
                    ->where('work_order_no', $wo['wo_no'])
                    ->where('deleted_at', null)
                    ->get()->getRowArray();

                if ($existWo === null) {
                    $this->db->table('subcontract_work_orders')->insert([
                        'company_id' => $companyId,
                        'project_id' => $pId,
                        'contractor_id' => $cId,
                        'work_order_no' => $wo['wo_no'],
                        'work_order_date' => $wo['date'],
                        'start_date' => $wo['date'],
                        'scope_of_work' => $wo['scope'],
                        'currency_code' => 'INR',
                        'total_order_value' => $wo['val'],
                        'revised_order_value' => $wo['val'],
                        'certified_amount' => $wo['paid'],
                        'paid_amount' => $wo['paid'],
                        'status_id' => $woStatusApproved,
                        'created_by' => $userId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            // ==========================================
            // 9. PROJECT BUDGETS & BUDGET LINES
            // ==========================================
            $budgetStatusApproved = $getMasterId('project_budgets_status_masters', 'status_code', 'APPROVED', 2);

            foreach ($createdProjectIds as $code => $pInfo) {
                $pId = $pInfo['id'];
                $bCode = 'BUD-KRR-' . substr($code, 8);

                $existBudget = $this->db->table('project_budgets')
                    ->where('company_id', $companyId)
                    ->where('project_id', $pId)
                    ->where('deleted_at', null)
                    ->get()->getRowArray();

                if ($existBudget === null) {
                    $tot = $pInfo['data']['budget'];
                    $direct = $tot * 0.85;
                    $overhead = $tot * 0.10;
                    $contingency = $tot * 0.05;

                    $this->db->table('project_budgets')->insert([
                        'company_id' => $companyId,
                        'project_id' => $pId,
                        'financial_year_id' => $fyId,
                        'budget_code' => $bCode,
                        'budget_name' => $pInfo['data']['name'] . ' Master Project Budget',
                        'version_no' => 1,
                        'budget_date' => $pInfo['data']['start'],
                        'currency_code' => 'INR',
                        'direct_cost' => $direct,
                        'overhead_cost' => $overhead,
                        'contingency_amount' => $contingency,
                        'total_budget' => $tot,
                        'status_id' => $budgetStatusApproved,
                        'created_by' => $userId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                    $budgetId = (int) $this->db->insertID();

                    // Budget lines
                    $lines = [
                        ['code' => 'MAT', 'name' => 'Raw Materials (Cement, TMT Steel, Aggregates)', 'amt' => $tot * 0.40],
                        ['code' => 'SUBCON', 'name' => 'Subcontract Work Orders & Labour', 'amt' => $tot * 0.35],
                        ['code' => 'PLANT', 'name' => 'Equipment, Cranes & Transit Mixers', 'amt' => $tot * 0.15],
                        ['code' => 'ADMIN', 'name' => 'Site Supervision & Project Overheads', 'amt' => $tot * 0.10],
                    ];

                    foreach ($lines as $l) {
                        $this->db->table('project_budget_lines')->insert([
                            'company_id' => $companyId,
                            'project_id' => $pId,
                            'budget_id' => $budgetId,
                            'line_code' => $bCode . '-' . $l['code'],
                            'line_name' => $l['name'],
                            'budget_amount' => $l['amt'],
                            'revised_amount' => $l['amt'],
                            'actual_amount' => $l['amt'] * ($pInfo['data']['actual_pct'] / 100.0),
                            'created_by' => $userId,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]);
                    }
                }
            }

            // ==========================================
            // 10. DAILY SITE REPORTS (DPRs)
            // ==========================================
            $dprStatusApproved = $getMasterId('daily_site_reports_status_masters', 'status_code', 'APPROVED', 3);
            $shiftGeneral = $getMasterId('daily_site_reports_shift_type_masters', 'shift_type_code', 'GENERAL', 1);

            $demoDprs = [
                [
                    'prj' => 'PRJ-KRR-001',
                    'site' => 'STE-KMC-01',
                    'report_no' => 'DPR-KMC-001',
                    'date' => $today,
                    'planned' => 65.0,
                    'actual' => 68.0,
                    'manpower' => 52,
                    'equipment' => 8,
                    'summary' => 'KMC Hospital Gandhigramam ICU 3rd floor roof slab concrete pouring completed (210 cum). Modular OT electrical conduits and oxygen pipeline sleeves laid.',
                ],
                [
                    'prj' => 'PRJ-KRR-002',
                    'site' => 'STE-VAL-01',
                    'report_no' => 'DPR-VAL-001',
                    'date' => $today,
                    'planned' => 45.0,
                    'actual' => 42.0,
                    'manpower' => 44,
                    'equipment' => 5,
                    'summary' => 'Valluvar Hotel Kovai Road banquet hall ceiling grid framing in progress. 4th floor guest room vitrified tile flooring completed for 12 rooms.',
                ],
                [
                    'prj' => 'PRJ-KRR-003',
                    'site' => 'STE-BSH-01',
                    'report_no' => 'DPR-BSH-001',
                    'date' => $today,
                    'planned' => 50.0,
                    'actual' => 54.0,
                    'manpower' => 38,
                    'equipment' => 4,
                    'summary' => 'Bosch Showroom Karur Bypass customer lounge toughened glass facade installation completed. Workshop epoxy flooring primer coat applied.',
                ],
                [
                    'prj' => 'PRJ-KRR-004',
                    'site' => 'STE-CHT-01',
                    'report_no' => 'DPR-CHT-001',
                    'date' => $today,
                    'planned' => 28.0,
                    'actual' => 30.0,
                    'manpower' => 42,
                    'equipment' => 6,
                    'summary' => 'Chettinad College Puliyur academic block Wing A ground floor brick masonry and lintel beam shuttering in active progress.',
                ],
            ];

            foreach ($demoDprs as $dpr) {
                $pId = $createdProjectIds[$dpr['prj']]['id'];
                $sId = $createdSiteIds[$dpr['site']];

                $existDpr = $this->db->table('daily_site_reports')
                    ->where('company_id', $companyId)
                    ->where('project_id', $pId)
                    ->where('site_id', $sId)
                    ->where('report_date', $dpr['date'])
                    ->where('deleted_at', null)
                    ->get()->getRowArray();

                if ($existDpr === null) {
                    $this->db->table('daily_site_reports')->insert([
                        'company_id' => $companyId,
                        'project_id' => $pId,
                        'site_id' => $sId,
                        'report_no' => $dpr['report_no'],
                        'report_date' => $dpr['date'],
                        'shift_type_id' => $shiftGeneral,
                        'work_start_time' => '08:00:00',
                        'work_end_time' => '17:30:00',
                        'safety_briefing_done' => 1,
                        'safety_incident_count' => 0,
                        'total_manpower' => $dpr['manpower'],
                        'total_equipment' => $dpr['equipment'],
                        'planned_progress_percentage' => $dpr['planned'],
                        'actual_progress_percentage' => $dpr['actual'],
                        'overall_work_summary' => $dpr['summary'],
                        'next_day_plan' => 'Continue next staging phase, reinforcement tying, and quality inspection with site engineer.',
                        'status_id' => $dprStatusApproved,
                        'created_by' => $userId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            // ==========================================
            // 11. EXPENSES & PAYMENTS
            // ==========================================
            $expenseStatusApproved = $getMasterId('expense_bills_status_masters', 'status_code', 'APPROVED', 2);
            $expensePaymentPaid = $getMasterId('expense_bills_payment_status_masters', 'payment_status_code', 'PAID', 2);

            $demoExpenses = [
                ['prj' => 'PRJ-KRR-001', 'v_no' => 'EXP-KMC-001', 'payee' => 'Dalmia Ready Mix Concrete Karur', 'amount' => 520000.00, 'paid' => 520000.00],
                ['prj' => 'PRJ-KRR-002', 'v_no' => 'EXP-VAL-002', 'payee' => 'Havells Commercial Lighting & Cables Karur', 'amount' => 430000.00, 'paid' => 430000.00],
                ['prj' => 'PRJ-KRR-003', 'v_no' => 'EXP-BSH-003', 'payee' => 'Saint-Gobain Glass & Aluminium Facades', 'amount' => 310000.00, 'paid' => 310000.00],
                ['prj' => 'PRJ-KRR-004', 'v_no' => 'EXP-CHT-004', 'payee' => 'Chettinad Cement Corporation Puliyur', 'amount' => 380000.00, 'paid' => 380000.00],
            ];

            foreach ($demoExpenses as $exp) {
                $pId = $createdProjectIds[$exp['prj']]['id'];

                $existExp = $this->db->table('expense_bills')
                    ->where('company_id', $companyId)
                    ->where('project_id', $pId)
                    ->where('internal_voucher_no', $exp['v_no'])
                    ->where('deleted_at', null)
                    ->get()->getRowArray();

                if ($existExp === null) {
                    $this->db->table('expense_bills')->insert([
                        'company_id' => $companyId,
                        'project_id' => $pId,
                        'bill_no' => 'BILL-' . substr($exp['v_no'], 4),
                        'internal_voucher_no' => $exp['v_no'],
                        'bill_date' => $today,
                        'payee_type_id' => 1,
                        'payee_name' => $exp['payee'],
                        'subtotal' => $exp['amount'] * 0.82,
                        'taxable_amount' => $exp['amount'] * 0.82,
                        'cgst_amount' => $exp['amount'] * 0.09,
                        'sgst_amount' => $exp['amount'] * 0.09,
                        'gross_amount' => $exp['amount'],
                        'net_payable' => $exp['amount'],
                        'paid_amount' => $exp['paid'],
                        'outstanding_amount' => 0.00,
                        'payment_status_id' => $expensePaymentPaid,
                        'status_id' => $expenseStatusApproved,
                        'created_by' => $userId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            // ==========================================
            // 12. DASHBOARD ALERTS & REVIEWS
            // ==========================================
            $alertTypeMaterial = $getMasterId('dashboard_alerts_alert_type_masters', 'alert_type_code', 'MATERIAL', 1);
            $alertSevMedium = $getMasterId('dashboard_alerts_severity_masters', 'severity_code', 'MEDIUM', 2);
            $alertStatusOpen = $getMasterId('dashboard_alerts_status_masters', 'status_code', 'OPEN', 1);

            $p1Id = $createdProjectIds['PRJ-KRR-001']['id'];
            $existAlt = $this->db->table('dashboard_alerts')
                ->where('company_id', $companyId)
                ->where('project_id', $p1Id)
                ->where('alert_no', 'ALT-KMC-001')
                ->get()->getRowArray();

            if ($existAlt === null) {
                $this->db->table('dashboard_alerts')->insert([
                    'company_id' => $companyId,
                    'project_id' => $p1Id,
                    'alert_no' => 'ALT-KMC-001',
                    'alert_type_id' => $alertTypeMaterial,
                    'severity_id' => $alertSevMedium,
                    'title' => 'KMC Hospital OT Copper Piping Inspection',
                    'message' => 'Medical gas pipeline pressure testing scheduled for ICU Block 3rd floor. Consultant signoff pending.',
                    'source_module' => 'MEP_OPERATIONS',
                    'alert_date' => $now,
                    'due_date' => date('Y-m-d', strtotime('+3 days')),
                    'status_id' => $alertStatusOpen,
                    'created_by' => $userId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            $this->db->transCommit();
            echo "Demo Data Seeded Successfully with Karur Local Projects: KMC Hospital, Valluvar Hotel, Bosch Showroom, Chettinad College!\n";

        } catch (Throwable $e) {
            $this->db->transRollback();
            throw $e;
        }
    }
}
