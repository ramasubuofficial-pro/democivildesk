<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

class MastersController extends BaseController
{
    /**
     * Return the active master values required by company, branch, user,
     * role and permission forms.
     */
    public function index(): ResponseInterface
    {
        try {
            $db = db_connect();

            return $this->response->setJSON([
                'success' => true,
                'message' => 'Masters retrieved successfully.',
                'data' => [
                    'company_types' => $db->table('company_types')
                        ->select('id, type_code AS code, type_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'subscription_statuses' => $db->table('subscription_statuses')
                        ->select('id, status_code AS code, status_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'branch_types' => $db->table('branch_types')
                        ->select('id, type_code AS code, type_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'user_types' => $db->table('users_user_type_masters')
                        ->select('id, user_type_code AS code, user_type_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'user_statuses' => $db->table('user_statuses')
                        ->select('id, status_code AS code, status_name AS name, is_login_allowed')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'access_levels' => $db->table('user_branch_access_access_level_masters')
                        ->select('id, access_level_code AS code, access_level_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'role_scopes' => $db->table('role_scopes')
                        ->select('id, scope_code AS code, scope_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'permission_action_types' => $db->table('permissions_action_type_masters')
                        ->select('id, action_type_code AS code, action_type_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'gst_registration_types' => $db->table('gst_registration_types')
                        ->select('id, type_code AS code, type_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'client_sources' => $db->table('client_sources')
                        ->select('id, source_code AS code, source_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'client_statuses' => $db->table('client_statuses')
                        ->select('id, status_code AS code, status_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'communication_modes' => $db->table('communication_modes')
                        ->select('id, mode_code AS code, mode_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'client_document_types' => $db->table('document_types')
                        ->select([
                            'document_types.id',
                            'document_types.document_type_code AS code',
                            'document_types.document_type_name AS name',
                            'document_types.allowed_extensions',
                            'document_types.maximum_file_size_mb',
                            'document_types.expiry_tracking',
                            'document_types.is_mandatory',
                        ])
                        ->join(
                            'document_types_entity_scope_masters',
                            'document_types_entity_scope_masters.id = document_types.entity_scope_id'
                        )
                        ->where('document_types.company_id', (int) auth('session')->user()->company_id)
                        ->where('document_types.is_active', 1)
                        ->where('document_types.deleted_at', null)
                        ->where('document_types_entity_scope_masters.entity_scope_code', 'CLIENT')
                        ->where('document_types_entity_scope_masters.is_active', 1)
                        ->orderBy('document_types.display_order', 'ASC')
                        ->get()->getResultArray(),
                    'client_document_statuses' => $db->table('client_document_statuses')
                        ->select('id, status_code AS code, status_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'project_document_types' => $db->table('document_types')
                        ->select([
                            'document_types.id',
                            'document_types.document_type_code AS code',
                            'document_types.document_type_name AS name',
                            'document_types.allowed_extensions',
                            'document_types.maximum_file_size_mb',
                            'document_types.expiry_tracking',
                            'document_types.is_mandatory',
                        ])
                        ->join(
                            'document_types_entity_scope_masters',
                            'document_types_entity_scope_masters.id = document_types.entity_scope_id'
                        )
                        ->where('document_types.company_id', (int) auth('session')->user()->company_id)
                        ->where('document_types.is_active', 1)
                        ->where('document_types.deleted_at', null)
                        ->where('document_types_entity_scope_masters.entity_scope_code', 'PROJECT')
                        ->where('document_types_entity_scope_masters.is_active', 1)
                        ->orderBy('document_types.display_order', 'ASC')
                        ->get()->getResultArray(),
                    'project_document_statuses' => $db->table('project_documents_status_masters')
                        ->select('id, status_code AS code, status_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'billing_methods' => $db->table('billing_methods')
                        ->select('id, method_code AS code, method_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'project_types' => $db->table('project_types')
                        ->select([
                            'project_types.id',
                            'project_types.project_type_code AS code',
                            'project_types.project_type_name AS name',
                            'project_types.billing_method_id',
                            'billing_methods.method_code AS billing_method_code',
                            'billing_methods.method_name AS billing_method_name',
                            'project_types.default_duration_days',
                        ])
                        ->join('billing_methods', 'billing_methods.id = project_types.billing_method_id')
                        ->where('project_types.company_id', (int) auth('session')->user()->company_id)
                        ->where('project_types.is_active', 1)
                        ->where('project_types.deleted_at', null)
                        ->orderBy('project_types.display_order', 'ASC')
                        ->get()->getResultArray(),
                    'project_statuses' => $db->table('project_statuses')
                        ->select('id, status_code AS code, status_name AS name, description, is_final')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'project_milestone_statuses' => $db->table('project_milestone_status_masters')
                        ->select('id, status_code AS code, status_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'attendance_exception_categories' => $db->table('labour_attendance_exception_category_masters')
                        ->select('id, category_code AS code, category_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'attendance_exception_statuses' => $db->table('labour_attendance_exception_status_masters')
                        ->select('id, status_code AS code, status_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'project_boq_statuses' => $db->table('project_boqs_status_masters')
                        ->select('id, status_code AS code, status_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'project_budget_statuses' => $db->table('project_budgets_status_masters')
                        ->select('id, status_code AS code, status_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'project_budget_cost_types' => $db->table('project_budget_lines_cost_type_masters')
                        ->select('id, cost_type_code AS code, cost_type_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'site_types' => $db->table('site_types')
                        ->select('id, type_code AS code, type_name AS name, description')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'site_statuses' => $db->table('site_statuses')
                        ->select('id, status_code AS code, status_name AS name, description, is_final')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'site_zone_types' => $db->table('site_work_zones_zone_type_masters')
                        ->select('id, zone_type_code AS code, zone_type_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'site_zone_statuses' => $db->table('site_work_zones_status_masters')
                        ->select('id, status_code AS code, status_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'work_location_types' => $db->table('work_location_types')
                        ->select('id, type_code AS code, type_name AS name, description')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'work_location_statuses' => $db->table('work_location_statuses')
                        ->select('id, status_code AS code, status_name AS name, description')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'project_team_roles' => $db->table('project_team_roles')
                        ->select('id, role_code AS code, role_name AS name, description')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'priorities' => $db->table('priorities')
                        ->select('id, priority_code AS code, priority_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'financial_years' => $db->table('financial_years')
                        ->select('id, year_code AS code, year_name AS name, start_date, end_date, status_id, is_current')
                        ->where('company_id', (int) auth('session')->user()->company_id)
                        ->where('is_active', 1)
                        ->where('deleted_at', null)
                        ->orderBy('start_date', 'DESC')->get()->getResultArray(),
                    'financial_year_statuses' => $db->table('financial_years_status_masters')
                        ->select('id, status_code AS code, status_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'unit_types' => $db->table('units_of_measurement_unit_type_masters')
                        ->select('id, unit_type_code AS code, unit_type_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'units_of_measurement' => $db->table('units_of_measurement')
                        ->select('id, unit_code AS code, unit_name AS name, unit_symbol, unit_type_id, decimal_places')
                        ->where('company_id', (int) auth('session')->user()->company_id)
                        ->where('is_active', 1)
                        ->where('deleted_at', null)
                        ->orderBy('display_order', 'ASC')
                        ->orderBy('unit_name', 'ASC')->get()->getResultArray(),
                    'work_category_stages' => $db->table('work_categories_work_stage_masters')
                        ->select('id, work_stage_code AS code, work_stage_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'work_category_progress_methods' => $db->table('work_categories_progress_method_masters')
                        ->select('id, progress_method_code AS code, progress_method_name AS name')
                        ->where('is_active', 1)
                        ->orderBy('sort_order', 'ASC')->get()->getResultArray(),
                    'work_categories' => $db->table('work_categories')
                        ->select('id, category_code AS code, category_name AS name, parent_id, work_stage_id, progress_method_id')
                        ->where('company_id', (int) auth('session')->user()->company_id)
                        ->where('is_active', 1)
                        ->where('deleted_at', null)
                        ->orderBy('display_order', 'ASC')
                        ->orderBy('category_name', 'ASC')->get()->getResultArray(),
                    'project_clients' => $db->table('clients')
                        ->select('id, client_code AS code, client_name AS name, branch_id')
                        ->where('company_id', (int) auth('session')->user()->company_id)
                        ->where('deleted_at', null)
                        ->orderBy('client_name', 'ASC')->get()->getResultArray(),
                    'project_users' => $db->table('users')
                        ->select('id, employee_code AS code, CONCAT(first_name, " ", COALESCE(last_name, "")) AS name, default_branch_id')
                        ->where('company_id', (int) auth('session')->user()->company_id)
                        ->where('is_active', 1)
                        ->where('deleted_at', null)
                        ->orderBy('first_name', 'ASC')->get()->getResultArray(),
                ],
            ]);
        } catch (Throwable $exception) {
            log_message('error', 'Master retrieval failed: {message}', [
                'message' => $exception->getMessage(),
            ]);

            return $this->response
                ->setStatusCode(ResponseInterface::HTTP_INTERNAL_SERVER_ERROR)
                ->setJSON([
                    'success' => false,
                    'message' => 'Unable to retrieve masters.',
                ]);
        }
    }
}
