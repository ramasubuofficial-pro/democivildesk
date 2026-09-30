<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Database\Seeds\DemoDataSeeder;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;
use Throwable;

class DemoSeedController extends BaseController
{
    /**
     * Seed Karur demo data into database
     * GET /api/seed-demo
     * POST /api/seed-demo
     */
    public function index(): ResponseInterface
    {
        try {
            $seeder = new DemoDataSeeder(config('Database'));
            $seeder->run();

            return $this->response->setJSON([
                'success' => true,
                'message' => 'Demo data seeded successfully for Karur projects: KMC hospital, Valluvar hotel, Bosch Showroom, Chettinad college.',
                'data' => [
                    'projects_count' => 4,
                    'sites_count' => 8,
                    'zones_locations_count' => 24,
                    'contractors_count' => 4,
                ]
            ]);
        } catch (Throwable $e) {
            return $this->response->setStatusCode(ResponseInterface::HTTP_INTERNAL_SERVER_ERROR)->setJSON([
                'success' => false,
                'message' => 'Failed to seed demo data: ' . $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
        }
    }
}
