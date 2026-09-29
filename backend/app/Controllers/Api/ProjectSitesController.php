<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\AuthorizationService;
use App\Models\ProjectSiteModel;
use CodeIgniter\Database\Exceptions\DatabaseException;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

class ProjectSitesController extends BaseController
{
    private ProjectSiteModel $sites;
    private AuthorizationService $authorization;

    public function __construct()
    {
        $this->sites = new ProjectSiteModel();
        $this->authorization = new AuthorizationService();
    }

    public function index(): ResponseInterface
    {
        $user = auth('session')->user();
        if ($user === null) {
            return $this->unauthorized();
        }

        try {
            $builder = $this->baseQuery()
                ->where('project_sites.company_id', (int) $user->company_id);

            $projectId = (int) ($this->request->getGet('project_id') ?? 0);
            if ($projectId > 0) {
                $project = $this->getAccessibleProject($projectId, $user);
                if ($project === null) {
                    return $this->forbidden('You cannot access the selected project.');
                }
                $builder->where('project_sites.project_id', $projectId);
            } elseif (! $this->authorization->isSuperAdmin($user)) {
                $branchIds = $this->authorization->getAccessibleBranchIds($user);
                if ($branchIds === []) {
                    return $this->successList([]);
                }
                $builder->groupStart()
                    ->whereIn('projects.branch_id', $branchIds)
                    ->orWhere('projects.branch_id', null)
                    ->groupEnd();
            }

            foreach (['site_type_id', 'site_status_id', 'site_engineer_id', 'supervisor_id'] as $filter) {
                $value = (int) ($this->request->getGet($filter) ?? 0);
                if ($value > 0) {
                    $builder->where('project_sites.' . $filter, $value);
                }
            }

            $isPrimary = $this->request->getGet('is_primary');
            if ($isPrimary !== null && in_array((string) $isPrimary, ['0', '1'], true)) {
                $builder->where('project_sites.is_primary', (int) $isPrimary);
            }

            $search = trim((string) ($this->request->getGet('search') ?? ''));
            if ($search !== '') {
                $builder->groupStart()
                    ->like('project_sites.site_code', $search)
                    ->orLike('project_sites.site_name', $search)
                    ->orLike('project_sites.city', $search)
                    ->orLike('project_sites.district', $search)
                    ->orLike('projects.project_code', $search)
                    ->orLike('projects.project_name', $search)
                    ->groupEnd();
            }

            return $this->successList(
                $builder->orderBy('projects.project_name', 'ASC')
                    ->orderBy('project_sites.is_primary', 'DESC')
                    ->orderBy('project_sites.site_name', 'ASC')
                    ->findAll()
            );
        } catch (Throwable $exception) {
            return $this->serverError('Site list retrieval failed.', $exception);
        }
    }

    public function show(int $id): ResponseInterface
    {
        $user = auth('session')->user();
        if ($user === null) {
            return $this->unauthorized();
        }

        try {
            $site = $this->baseQuery()
                ->where('project_sites.company_id', (int) $user->company_id)
                ->find($id);

            if ($site === null || ! $this->canAccessSite($site, $user)) {
                return $this->notFound();
            }

            return $this->response->setJSON([
                'success' => true,
                'message' => 'Site retrieved successfully.',
                'data' => ['site' => $site],
            ]);
        } catch (Throwable $exception) {
            return $this->serverError('Site retrieval failed.', $exception);
        }
    }

    public function create(): ResponseInterface
    {
        $user = auth('session')->user();
        if ($user === null) {
            return $this->unauthorized();
        }

        $input = $this->request->getJSON(true);
        if (! is_array($input)) {
            return $this->invalid(['body' => 'A valid JSON request body is required.']);
        }

        $data = $this->writableData($input, true);
        $data['company_id'] = (int) $user->company_id;
        $data['created_by'] = (int) $user->id;
        $data['updated_by'] = (int) $user->id;
        $data += [
            'country_code' => 'IN',
            'latitude' => null,
            'longitude' => null,
            'geofence_radius_m' => null,
            'site_engineer_id' => null,
            'supervisor_id' => null,
            'planned_start_date' => null,
            'actual_start_date' => null,
            'expected_end_date' => null,
            'actual_end_date' => null,
            'progress_percentage' => 0,
            'is_primary' => 0,
        ];

        $validation = $this->validateReferences($data, $user);
        if ($validation !== null) {
            return $validation;
        }

        $dateErrors = $this->validateDates($data);
        if ($dateErrors !== []) {
            return $this->invalid($dateErrors);
        }

        if ($this->duplicateSiteCodeExists(
            (int) $data['project_id'],
            (string) $data['site_code']
        )) {
            return $this->invalid([
                'site_code' => 'The site code already exists for the selected project.',
            ]);
        }

        $db = db_connect();
        try {
            $db->transBegin();

            if ((int) $data['is_primary'] === 1) {
                $this->clearOtherPrimarySites((int) $data['project_id'], null, (int) $user->id);
            }

            if (! $this->sites->insert($data)) {
                $db->transRollback();
                return $this->invalid($this->sites->errors());
            }

            $id = (int) $this->sites->getInsertID();
            $db->table('site_status_logs')->insert([
                'company_id' => (int) $user->company_id,
                'project_id' => (int) $data['project_id'],
                'site_id' => $id,
                'from_status_id' => null,
                'to_status_id' => (int) $data['site_status_id'],
                'change_reason' => 'Site created.',
                'changed_by' => (int) $user->id,
            ]);

            if ($db->transStatus() === false) {
                throw new DatabaseException('Unable to create site and initial status history.');
            }

            $db->transCommit();

            return $this->response
                ->setStatusCode(ResponseInterface::HTTP_CREATED)
                ->setJSON([
                    'success' => true,
                    'message' => 'Site created successfully.',
                    'data' => ['site' => $this->baseQuery()->find($id)],
                ]);
        } catch (DatabaseException $exception) {
            $db->transRollback();
            return $this->databaseConflict($exception);
        } catch (Throwable $exception) {
            $db->transRollback();
            return $this->serverError('Site creation failed.', $exception);
        }
    }

    public function update(int $id): ResponseInterface
    {
        $user = auth('session')->user();
        if ($user === null) {
            return $this->unauthorized();
        }

        $existing = $this->sites
            ->where('company_id', (int) $user->company_id)
            ->find($id);
        if ($existing === null || ! $this->canAccessSite($existing, $user, true)) {
            return $this->notFound();
        }

        $input = $this->request->getJSON(true);
        if (! is_array($input) || $input === []) {
            return $this->invalid(['body' => 'A non-empty JSON request body is required.']);
        }

        $data = $this->writableData($input, false);
        unset($data['company_id'], $data['created_by'], $data['project_id'], $data['site_status_id']);
        $data['updated_by'] = (int) $user->id;
        $merged = array_merge($existing, $data);

        $validation = $this->validateReferences($merged, $user);
        if ($validation !== null) {
            return $validation;
        }

        $dateErrors = $this->validateDates($merged);
        if ($dateErrors !== []) {
            return $this->invalid($dateErrors);
        }

        if (array_key_exists('site_code', $data) && $this->duplicateSiteCodeExists(
            (int) $existing['project_id'],
            (string) $data['site_code'],
            $id
        )) {
            return $this->invalid([
                'site_code' => 'The site code already exists for the selected project.',
            ]);
        }

        $db = db_connect();
        try {
            $db->transBegin();

            if ((int) ($merged['is_primary'] ?? 0) === 1) {
                $this->clearOtherPrimarySites((int) $existing['project_id'], $id, (int) $user->id);
            }

            if (! $this->sites->update($id, $data)) {
                $db->transRollback();
                return $this->invalid($this->sites->errors());
            }

            if ($db->transStatus() === false) {
                throw new DatabaseException('Unable to update the site.');
            }

            $db->transCommit();

            return $this->response->setJSON([
                'success' => true,
                'message' => 'Site updated successfully.',
                'data' => ['site' => $this->baseQuery()->find($id)],
            ]);
        } catch (DatabaseException $exception) {
            $db->transRollback();
            return $this->databaseConflict($exception);
        } catch (Throwable $exception) {
            $db->transRollback();
            return $this->serverError('Site update failed.', $exception);
        }
    }

    public function statusHistory(int $id): ResponseInterface
    {
        $user = auth('session')->user();
        if ($user === null) {
            return $this->unauthorized();
        }

        $site = $this->sites->where('company_id', (int) $user->company_id)->find($id);
        if ($site === null || ! $this->canAccessSite($site, $user)) {
            return $this->notFound();
        }

        try {
            $history = db_connect()->table('site_status_logs logs')
                ->select([
                    'logs.id', 'logs.company_id', 'logs.project_id', 'logs.site_id',
                    'logs.from_status_id', 'from_status.status_code AS from_status_code',
                    'from_status.status_name AS from_status_name', 'logs.to_status_id',
                    'to_status.status_code AS to_status_code', 'to_status.status_name AS to_status_name',
                    'logs.change_reason', 'logs.changed_by', 'users.employee_code AS changed_by_employee_code',
                    'users.first_name AS changed_by_first_name', 'users.last_name AS changed_by_last_name',
                    'logs.changed_at',
                ])
                ->join('site_statuses from_status', 'from_status.id = logs.from_status_id', 'left')
                ->join('site_statuses to_status', 'to_status.id = logs.to_status_id', 'left')
                ->join('users', 'users.id = logs.changed_by', 'left')
                ->where('logs.company_id', (int) $user->company_id)
                ->where('logs.project_id', (int) $site['project_id'])
                ->where('logs.site_id', $id)
                ->orderBy('logs.changed_at', 'DESC')
                ->orderBy('logs.id', 'DESC')
                ->get()->getResultArray();

            return $this->response->setJSON([
                'success' => true,
                'message' => 'Site status history retrieved successfully.',
                'data' => ['status_history' => $history],
            ]);
        } catch (Throwable $exception) {
            return $this->serverError('Site status history retrieval failed.', $exception);
        }
    }

    public function changeStatus(int $id): ResponseInterface
    {
        $user = auth('session')->user();
        if ($user === null) {
            return $this->unauthorized();
        }

        $site = $this->sites->where('company_id', (int) $user->company_id)->find($id);
        if ($site === null || ! $this->canAccessSite($site, $user, true)) {
            return $this->notFound();
        }

        $input = $this->request->getJSON(true);
        if (! is_array($input)) {
            return $this->invalid(['body' => 'A valid JSON request body is required.']);
        }

        $toStatusId = (int) ($input['site_status_id'] ?? 0);
        $changeReason = trim((string) ($input['change_reason'] ?? ''));
        $errors = [];
        if ($toStatusId <= 0 || ! $this->activeMasterExists('site_statuses', $toStatusId)) {
            $errors['site_status_id'] = 'Select a valid active site status.';
        }
        if ($changeReason === '') {
            $errors['change_reason'] = 'Change reason is required.';
        } elseif (mb_strlen($changeReason) > 500) {
            $errors['change_reason'] = 'Change reason cannot exceed 500 characters.';
        }
        if ($toStatusId === (int) $site['site_status_id']) {
            $errors['site_status_id'] = 'The site is already in the selected status.';
        }
        if ($errors !== []) {
            return $this->invalid($errors);
        }

        $db = db_connect();
        try {
            $db->transBegin();
            if (! $this->sites->update($id, [
                'site_status_id' => $toStatusId,
                'updated_by' => (int) $user->id,
            ])) {
                $db->transRollback();
                return $this->invalid($this->sites->errors());
            }

            $db->table('site_status_logs')->insert([
                'company_id' => (int) $user->company_id,
                'project_id' => (int) $site['project_id'],
                'site_id' => $id,
                'from_status_id' => (int) $site['site_status_id'],
                'to_status_id' => $toStatusId,
                'change_reason' => $changeReason,
                'changed_by' => (int) $user->id,
            ]);

            if ($db->transStatus() === false) {
                throw new DatabaseException('Unable to save the site status history.');
            }
            $db->transCommit();

            return $this->response->setJSON([
                'success' => true,
                'message' => 'Site status changed successfully.',
                'data' => ['site' => $this->baseQuery()->find($id)],
            ]);
        } catch (DatabaseException $exception) {
            $db->transRollback();
            return $this->databaseConflict($exception);
        } catch (Throwable $exception) {
            $db->transRollback();
            return $this->serverError('Site status change failed.', $exception);
        }
    }

    public function delete(int $id): ResponseInterface
    {
        $user = auth('session')->user();
        if ($user === null) {
            return $this->unauthorized();
        }

        $site = $this->sites->where('company_id', (int) $user->company_id)->find($id);
        if ($site === null || ! $this->canAccessSite($site, $user, true)) {
            return $this->notFound();
        }

        try {
            $this->sites->update($id, ['updated_by' => (int) $user->id]);
            $this->sites->delete($id);

            return $this->response->setJSON([
                'success' => true,
                'message' => 'Site deleted successfully.',
            ]);
        } catch (DatabaseException $exception) {
            return $this->response->setStatusCode(ResponseInterface::HTTP_CONFLICT)->setJSON([
                'success' => false,
                'message' => 'This site cannot be deleted because it is used by existing records.',
            ]);
        } catch (Throwable $exception) {
            return $this->serverError('Site deletion failed.', $exception);
        }
    }

    private function baseQuery(): ProjectSiteModel
    {
        return $this->sites
            ->select([
                'project_sites.*',
                'projects.project_code', 'projects.project_name', 'projects.branch_id AS project_branch_id',
                'branches.branch_code', 'branches.branch_name',
                'site_types.type_code AS site_type_code', 'site_types.type_name AS site_type_name',
                'site_statuses.status_code AS site_status_code', 'site_statuses.status_name AS site_status_name',
                'engineer.employee_code AS site_engineer_code', 'engineer.first_name AS site_engineer_first_name',
                'engineer.last_name AS site_engineer_last_name',
                'supervisor.employee_code AS supervisor_code', 'supervisor.first_name AS supervisor_first_name',
                'supervisor.last_name AS supervisor_last_name',
            ])
            ->join('projects', 'projects.id = project_sites.project_id AND projects.company_id = project_sites.company_id')
            ->join('branches', 'branches.id = projects.branch_id', 'left')
            ->join('site_types', 'site_types.id = project_sites.site_type_id')
            ->join('site_statuses', 'site_statuses.id = project_sites.site_status_id')
            ->join('users engineer', 'engineer.id = project_sites.site_engineer_id', 'left')
            ->join('users supervisor', 'supervisor.id = project_sites.supervisor_id', 'left');
    }

    private function writableData(array $input, bool $creating): array
    {
        $fields = [
            'project_id', 'site_code', 'site_name', 'site_type_id', 'address_line1', 'address_line2',
            'landmark', 'city', 'district', 'state_name', 'state_code', 'country_code', 'postal_code',
            'latitude', 'longitude', 'geofence_radius_m', 'contact_name', 'contact_phone',
            'site_engineer_id', 'supervisor_id', 'planned_start_date', 'actual_start_date',
            'expected_end_date', 'actual_end_date', 'site_status_id', 'progress_percentage',
            'is_primary', 'notes',
        ];

        if (! $creating) {
            $fields = array_values(array_diff($fields, ['project_id', 'site_status_id']));
        }

        return array_intersect_key($input, array_flip($fields));
    }

    private function validateReferences(array $data, object $user): ?ResponseInterface
    {
        $errors = [];
        $projectId = (int) ($data['project_id'] ?? 0);
        if ($projectId <= 0 || $this->getAccessibleProject($projectId, $user, true) === null) {
            $errors['project_id'] = 'Select a valid active project you are permitted to operate.';
        }

        foreach (['site_type_id' => 'site_types', 'site_status_id' => 'site_statuses'] as $field => $table) {
            $id = (int) ($data[$field] ?? 0);
            if (! $this->activeMasterExists($table, $id)) {
                $errors[$field] = 'Select a valid active ' . str_replace('_id', '', str_replace('_', ' ', $field)) . '.';
            }
        }

        foreach (['site_engineer_id', 'supervisor_id'] as $field) {
            $id = (int) ($data[$field] ?? 0);
            if ($id > 0 && ! $this->companyUserExists($id, (int) $user->company_id)) {
                $errors[$field] = 'Select a valid active user for this company.';
            }
        }

        return $errors === [] ? null : $this->invalid($errors);
    }

    private function validateDates(array $data): array
    {
        $errors = [];
        if (! empty($data['planned_start_date']) && ! empty($data['expected_end_date'])
            && $data['expected_end_date'] < $data['planned_start_date']) {
            $errors['expected_end_date'] = 'Expected end date cannot be before planned start date.';
        }
        if (! empty($data['actual_start_date']) && ! empty($data['actual_end_date'])
            && $data['actual_end_date'] < $data['actual_start_date']) {
            $errors['actual_end_date'] = 'Actual end date cannot be before actual start date.';
        }
        return $errors;
    }

    private function getAccessibleProject(int $projectId, object $user, bool $operate = false): ?array
    {
        $project = db_connect()->table('projects')
            ->where('id', $projectId)
            ->where('company_id', (int) $user->company_id)
            ->where('deleted_at', null)
            ->get()->getRowArray();
        if ($project === null) {
            return null;
        }

        $branchId = (int) ($project['branch_id'] ?? 0);
        if ($branchId > 0 && ! $this->authorization->canAccessBranch($branchId, $operate ? 'OPERATE' : 'VIEW', $user)) {
            return null;
        }
        return $project;
    }

    private function canAccessSite(array $site, object $user, bool $operate = false): bool
    {
        if ((int) $site['company_id'] !== (int) $user->company_id) {
            return false;
        }
        return $this->getAccessibleProject((int) $site['project_id'], $user, $operate) !== null;
    }

    private function activeMasterExists(string $table, int $id): bool
    {
        return $id > 0 && db_connect()->table($table)
            ->where('id', $id)->where('is_active', 1)->countAllResults() === 1;
    }

    private function companyUserExists(int $id, int $companyId): bool
    {
        return db_connect()->table('users')->where('id', $id)->where('company_id', $companyId)
            ->where('is_active', 1)->where('deleted_at', null)->countAllResults() === 1;
    }

    private function duplicateSiteCodeExists(int $projectId, string $siteCode, ?int $exceptId = null): bool
    {
        $builder = db_connect()->table('project_sites')
            ->where('project_id', $projectId)
            ->where('site_code', strtoupper(trim($siteCode)))
            ->where('deleted_at', null);

        if ($exceptId !== null) {
            $builder->where('id !=', $exceptId);
        }

        return $builder->countAllResults() > 0;
    }

    private function clearOtherPrimarySites(int $projectId, ?int $exceptId, int $userId): void
    {
        $builder = db_connect()->table('project_sites')
            ->where('project_id', $projectId)->where('is_primary', 1)->where('deleted_at', null);
        if ($exceptId !== null) {
            $builder->where('id !=', $exceptId);
        }
        $builder->update(['is_primary' => 0, 'updated_by' => $userId]);
    }

    private function successList(array $sites): ResponseInterface
    {
        return $this->response->setJSON([
            'success' => true,
            'message' => 'Sites retrieved successfully.',
            'data' => ['sites' => $sites],
        ]);
    }

    private function unauthorized(): ResponseInterface
    {
        return $this->response->setStatusCode(ResponseInterface::HTTP_UNAUTHORIZED)
            ->setJSON(['success' => false, 'message' => 'Authentication required.']);
    }

    private function forbidden(string $message): ResponseInterface
    {
        return $this->response->setStatusCode(ResponseInterface::HTTP_FORBIDDEN)
            ->setJSON(['success' => false, 'message' => $message]);
    }

    private function notFound(): ResponseInterface
    {
        return $this->response->setStatusCode(ResponseInterface::HTTP_NOT_FOUND)
            ->setJSON(['success' => false, 'message' => 'Site not found.']);
    }

    private function invalid(array $errors): ResponseInterface
    {
        return $this->response->setStatusCode(ResponseInterface::HTTP_UNPROCESSABLE_ENTITY)
            ->setJSON(['success' => false, 'message' => 'Validation failed.', 'errors' => $errors]);
    }

    private function databaseConflict(DatabaseException $exception): ResponseInterface
    {
        log_message('warning', 'Site database conflict: {message}', ['message' => $exception->getMessage()]);
        return $this->response->setStatusCode(ResponseInterface::HTTP_CONFLICT)->setJSON([
            'success' => false,
            'message' => 'Site code already exists for this project or the record conflicts with existing data.',
        ]);
    }

    private function serverError(string $message, Throwable $exception): ResponseInterface
    {
        log_message('error', $message . ' {message}', ['message' => $exception->getMessage()]);
        return $this->response->setStatusCode(ResponseInterface::HTTP_INTERNAL_SERVER_ERROR)
            ->setJSON(['success' => false, 'message' => 'Unable to process the site request.']);
    }
}
