<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\AuthorizationService;
use App\Models\ProjectBoqModel;
use App\Services\BoqNotificationService;
use CodeIgniter\Database\Exceptions\DatabaseException;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

class ProjectBoqsController extends BaseController
{
    private ProjectBoqModel $boqs;
    private AuthorizationService $authorization;

    public function __construct()
    {
        $this->boqs = new ProjectBoqModel();
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
                ->where('project_boqs.company_id', (int) $user->company_id);

            $projectId = (int) ($this->request->getGet('project_id') ?? 0);
            if ($projectId > 0) {
                if ($this->getAccessibleProject($projectId, $user) === null) {
                    return $this->forbidden('You cannot access the selected project.');
                }
                $builder->where('project_boqs.project_id', $projectId);
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

            $statusId = (int) ($this->request->getGet('status_id') ?? 0);
            if ($statusId > 0) {
                $builder->where('project_boqs.status_id', $statusId);
            }

            $search = trim((string) ($this->request->getGet('search') ?? ''));
            if ($search !== '') {
                $builder->groupStart()
                    ->like('project_boqs.boq_code', $search)
                    ->orLike('project_boqs.boq_name', $search)
                    ->orLike('projects.project_code', $search)
                    ->orLike('projects.project_name', $search)
                    ->groupEnd();
            }

            return $this->successList(
                $builder->orderBy('project_boqs.boq_date', 'DESC')
                    ->orderBy('project_boqs.id', 'DESC')
                    ->findAll()
            );
        } catch (Throwable $exception) {
            return $this->serverError('Project BOQ list retrieval failed.', $exception);
        }
    }

    public function show(int $id): ResponseInterface
    {
        $user = auth('session')->user();
        if ($user === null) {
            return $this->unauthorized();
        }

        try {
            $boq = $this->baseQuery()
                ->where('project_boqs.company_id', (int) $user->company_id)
                ->find($id);

            if ($boq === null || ! $this->canAccessBoq($boq, $user)) {
                return $this->notFound();
            }

            return $this->response->setJSON([
                'success' => true,
                'message' => 'Project BOQ retrieved successfully.',
                'data' => ['project_boq' => $boq],
            ]);
        } catch (Throwable $exception) {
            return $this->serverError('Project BOQ retrieval failed.', $exception);
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

        $draftStatus = $this->getStatusByCode('DRAFT');
        if ($draftStatus === null) {
            return $this->configurationError('The active DRAFT BOQ status is not configured.');
        }

        $data = $this->writableData($input);
        $data['company_id'] = (int) $user->company_id;
        $data['status_id'] = (int) $draftStatus['id'];
        $data['created_by'] = (int) $user->id;
        $data['updated_by'] = (int) $user->id;
        $data += [
            'version_no' => 1,
            'revision_no' => 0,
            'valid_from' => null,
            'currency_code' => 'INR',
            'total_amount' => 0,
            'notes' => null,
        ];

        if ($this->getAccessibleProject((int) ($data['project_id'] ?? 0), $user, true) === null) {
            return $this->invalid([
                'project_id' => 'Select a project you are permitted to operate.',
            ]);
        }

        if ($this->duplicateExists($data)) {
            return $this->duplicateValidation();
        }

        $db = db_connect();
        try {
            $db->transBegin();

            if (! $this->boqs->insert($data)) {
                $db->transRollback();
                return $this->invalid($this->boqs->errors());
            }

            if ($db->transStatus() === false) {
                throw new DatabaseException('Unable to create the project BOQ.');
            }

            $id = (int) $this->boqs->getInsertID();
            $db->transCommit();

            return $this->response
                ->setStatusCode(ResponseInterface::HTTP_CREATED)
                ->setJSON([
                    'success' => true,
                    'message' => 'Project BOQ created successfully.',
                    'data' => ['project_boq' => $this->baseQuery()->find($id)],
                ]);
        } catch (DatabaseException $exception) {
            $db->transRollback();
            return $this->databaseConflict($exception);
        } catch (Throwable $exception) {
            $db->transRollback();
            return $this->serverError('Project BOQ creation failed.', $exception);
        }
    }

    public function update(int $id): ResponseInterface
    {
        $user = auth('session')->user();
        if ($user === null) {
            return $this->unauthorized();
        }

        $existing = $this->boqs
            ->where('company_id', (int) $user->company_id)
            ->find($id);
        if ($existing === null || ! $this->canAccessBoq($existing, $user, true)) {
            return $this->notFound();
        }

        if (! $this->hasStatusCode($existing, 'DRAFT')) {
            return $this->conflict('Only a draft Project BOQ can be updated.');
        }

        $input = $this->request->getJSON(true);
        if (! is_array($input) || $input === []) {
            return $this->invalid(['body' => 'A non-empty JSON request body is required.']);
        }

        $data = $this->writableData($input);
        unset($data['project_id']);
        if ($data === []) {
            return $this->invalid(['body' => 'No writable Project BOQ fields were supplied.']);
        }
        $data['updated_by'] = (int) $user->id;

        $merged = array_merge($existing, $data);
        if ($this->duplicateExists($merged, $id)) {
            return $this->duplicateValidation();
        }

        $db = db_connect();
        try {
            $db->transBegin();

            if (! $this->boqs->update($id, $data)) {
                $db->transRollback();
                return $this->invalid($this->boqs->errors());
            }

            if ($db->transStatus() === false) {
                throw new DatabaseException('Unable to update the project BOQ.');
            }

            $db->transCommit();

            return $this->response->setJSON([
                'success' => true,
                'message' => 'Project BOQ updated successfully.',
                'data' => ['project_boq' => $this->baseQuery()->find($id)],
            ]);
        } catch (DatabaseException $exception) {
            $db->transRollback();
            return $this->databaseConflict($exception);
        } catch (Throwable $exception) {
            $db->transRollback();
            return $this->serverError('Project BOQ update failed.', $exception);
        }
    }

    public function submit(int $id): ResponseInterface
    {
        return $this->transition($id, 'DRAFT', 'UNDER_REVIEW', 'submitted');
    }

    public function approve(int $id): ResponseInterface
    {
        return $this->transition($id, 'UNDER_REVIEW', 'APPROVED', 'approved');
    }

    public function reject(int $id): ResponseInterface
    {
        return $this->transition($id, 'UNDER_REVIEW', 'REJECTED', 'rejected');
    }

    public function delete(int $id): ResponseInterface
    {
        $user = auth('session')->user();
        if ($user === null) {
            return $this->unauthorized();
        }

        $existing = $this->boqs
            ->where('company_id', (int) $user->company_id)
            ->find($id);
        if ($existing === null || ! $this->canAccessBoq($existing, $user, true)) {
            return $this->notFound();
        }

        if (! $this->hasStatusCode($existing, 'DRAFT')) {
            return $this->conflict('Only a draft Project BOQ can be deleted.');
        }

        $db = db_connect();
        try {
            $db->transBegin();
            if (! $this->boqs->update($id, ['updated_by' => (int) $user->id])) {
                $db->transRollback();
                return $this->invalid($this->boqs->errors());
            }
            if (! $this->boqs->delete($id) || $db->transStatus() === false) {
                throw new DatabaseException('Unable to delete the project BOQ.');
            }
            $db->transCommit();

            return $this->response->setJSON([
                'success' => true,
                'message' => 'Project BOQ deleted successfully.',
            ]);
        } catch (DatabaseException $exception) {
            $db->transRollback();
            return $this->databaseConflict($exception);
        } catch (Throwable $exception) {
            $db->transRollback();
            return $this->serverError('Project BOQ deletion failed.', $exception);
        }
    }

    private function transition(
        int $id,
        string $requiredStatusCode,
        string $targetStatusCode,
        string $action
    ): ResponseInterface {
        $user = auth('session')->user();
        if ($user === null) {
            return $this->unauthorized();
        }

        $targetStatus = $this->getStatusByCode($targetStatusCode);
        if ($targetStatus === null) {
            return $this->configurationError(
                'The active ' . $targetStatusCode . ' BOQ status is not configured.'
            );
        }

        $db = db_connect();
        try {
            $db->transBegin();

            $boq = $db->query(
                'SELECT pb.id, pb.company_id, pb.project_id, pb.status_id, pb.boq_code,
                        pb.boq_name, pb.submitted_by, p.branch_id, p.project_name,
                        status_master.status_code
                 FROM project_boqs pb
                 INNER JOIN projects p
                    ON p.id = pb.project_id AND p.company_id = pb.company_id
                 INNER JOIN project_boqs_status_masters status_master
                    ON status_master.id = pb.status_id
                 WHERE pb.id = ? AND pb.company_id = ?
                   AND pb.deleted_at IS NULL AND p.deleted_at IS NULL
                 FOR UPDATE',
                [$id, (int) $user->company_id]
            )->getRowArray();

            if ($boq === null || ! $this->canAccessBoq($boq, $user, true)) {
                $db->transRollback();
                return $this->notFound();
            }

            if ((string) $boq['status_code'] !== $requiredStatusCode) {
                $db->transRollback();
                return $this->conflict(
                    sprintf(
                        'Only a %s Project BOQ can be %s.',
                        strtolower(str_replace('_', ' ', $requiredStatusCode)),
                        $action
                    )
                );
            }

            $now = date('Y-m-d H:i:s');
            $update = [
                'status_id' => (int) $targetStatus['id'],
                'updated_by' => (int) $user->id,
            ];

            if ($action === 'submitted') {
                $update['submitted_by'] = (int) $user->id;
                $update['submitted_at'] = $now;
                $update['approved_by'] = null;
                $update['approved_at'] = null;
            } elseif ($action === 'approved') {
                $update['approved_by'] = (int) $user->id;
                $update['approved_at'] = $now;
            } else {
                $update['approved_by'] = null;
                $update['approved_at'] = null;
            }

            $updated = $db->table('project_boqs')
                ->where('id', $id)
                ->where('company_id', (int) $user->company_id)
                ->where('status_id', (int) $boq['status_id'])
                ->update($update);

            if (! $updated || $db->affectedRows() !== 1 || $db->transStatus() === false) {
                throw new DatabaseException('Unable to change the Project BOQ status.');
            }

            $db->transCommit();

            try {
                (new BoqNotificationService())->notify(
                    array_merge($boq, $update),
                    match ($action) {
                        'submitted' => 'BOQ_SUBMITTED',
                        'approved' => 'BOQ_APPROVED',
                        default => 'BOQ_REJECTED',
                    },
                    (int) $user->id
                );
            } catch (Throwable $notificationException) {
                log_message(
                    'error',
                    'BOQ {action} completed, but notification processing failed: {error}',
                    ['action' => $action, 'error' => $notificationException->getMessage()]
                );
            }

            return $this->response->setJSON([
                'success' => true,
                'message' => 'Project BOQ ' . $action . ' successfully.',
                'data' => ['project_boq' => $this->baseQuery()->find($id)],
            ]);
        } catch (DatabaseException $exception) {
            $db->transRollback();
            return $this->databaseConflict($exception);
        } catch (Throwable $exception) {
            $db->transRollback();
            return $this->serverError('Project BOQ status change failed.', $exception);
        }
    }

    private function baseQuery(): ProjectBoqModel
    {
        return $this->boqs
            ->select([
                'project_boqs.*',
                'projects.branch_id',
                'projects.project_code',
                'projects.project_name',
                'status_master.status_code',
                'status_master.status_name',
                'submitter.employee_code AS submitted_by_employee_code',
                'submitter.first_name AS submitted_by_first_name',
                'submitter.last_name AS submitted_by_last_name',
                'approver.employee_code AS approved_by_employee_code',
                'approver.first_name AS approved_by_first_name',
                'approver.last_name AS approved_by_last_name',
            ])
            ->join(
                'projects',
                'projects.id = project_boqs.project_id AND projects.company_id = project_boqs.company_id'
            )
            ->join(
                'project_boqs_status_masters status_master',
                'status_master.id = project_boqs.status_id'
            )
            ->join('users submitter', 'submitter.id = project_boqs.submitted_by', 'left')
            ->join('users approver', 'approver.id = project_boqs.approved_by', 'left')
            ->where('projects.deleted_at', null);
    }

    private function writableData(array $input): array
    {
        $fields = [
            'project_id', 'boq_code', 'boq_name', 'version_no', 'revision_no',
            'boq_date', 'valid_from', 'currency_code', 'total_amount', 'notes',
        ];

        return array_intersect_key($input, array_flip($fields));
    }

    private function getAccessibleProject(
        int $projectId,
        object $user,
        bool $operate = false
    ): ?array {
        if ($projectId <= 0) {
            return null;
        }

        $project = db_connect()->table('projects')
            ->select('id, company_id, branch_id')
            ->where('id', $projectId)
            ->where('company_id', (int) $user->company_id)
            ->where('deleted_at', null)
            ->get()
            ->getRowArray();

        if ($project === null) {
            return null;
        }

        $branchId = (int) ($project['branch_id'] ?? 0);
        if ($branchId > 0 && ! $this->authorization->canAccessBranch(
            $branchId,
            $operate ? 'OPERATE' : 'VIEW',
            $user
        )) {
            return null;
        }

        return $project;
    }

    private function canAccessBoq(array $boq, object $user, bool $operate = false): bool
    {
        return (int) $boq['company_id'] === (int) $user->company_id
            && $this->getAccessibleProject((int) $boq['project_id'], $user, $operate) !== null;
    }

    private function getStatusByCode(string $code): ?array
    {
        return db_connect()->table('project_boqs_status_masters')
            ->select('id, status_code, status_name')
            ->where('status_code', $code)
            ->where('is_active', 1)
            ->get()
            ->getRowArray();
    }

    private function hasStatusCode(array $boq, string $code): bool
    {
        return db_connect()->table('project_boqs_status_masters')
            ->where('id', (int) $boq['status_id'])
            ->where('status_code', $code)
            ->where('is_active', 1)
            ->countAllResults() === 1;
    }

    private function duplicateExists(array $data, ?int $excludeId = null): bool
    {
        if (
            (int) ($data['project_id'] ?? 0) <= 0
            || trim((string) ($data['boq_code'] ?? '')) === ''
            || (int) ($data['version_no'] ?? 0) <= 0
            || ! array_key_exists('revision_no', $data)
        ) {
            return false;
        }

        $builder = $this->boqs
            ->where('company_id', (int) $data['company_id'])
            ->where('project_id', (int) $data['project_id'])
            ->where('boq_code', strtoupper(trim((string) $data['boq_code'])))
            ->where('version_no', (int) $data['version_no'])
            ->where('revision_no', (int) $data['revision_no']);

        if ($excludeId !== null) {
            $builder->where('id !=', $excludeId);
        }

        return $builder->countAllResults() > 0;
    }

    private function successList(array $boqs): ResponseInterface
    {
        return $this->response->setJSON([
            'success' => true,
            'message' => 'Project BOQs retrieved successfully.',
            'data' => ['project_boqs' => $boqs],
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
            ->setJSON(['success' => false, 'message' => 'Project BOQ not found.']);
    }

    private function invalid(array $errors): ResponseInterface
    {
        return $this->response->setStatusCode(ResponseInterface::HTTP_UNPROCESSABLE_ENTITY)
            ->setJSON(['success' => false, 'message' => 'Validation failed.', 'errors' => $errors]);
    }

    private function duplicateValidation(): ResponseInterface
    {
        return $this->invalid([
            'boq_code' => 'The BOQ code, version and revision combination already exists for the selected project.',
        ]);
    }

    private function conflict(string $message): ResponseInterface
    {
        return $this->response->setStatusCode(ResponseInterface::HTTP_CONFLICT)
            ->setJSON(['success' => false, 'message' => $message]);
    }

    private function configurationError(string $message): ResponseInterface
    {
        log_message('error', $message);

        return $this->response->setStatusCode(ResponseInterface::HTTP_INTERNAL_SERVER_ERROR)
            ->setJSON(['success' => false, 'message' => $message]);
    }

    private function databaseConflict(DatabaseException $exception): ResponseInterface
    {
        log_message('warning', 'Project BOQ database conflict: {message}', [
            'message' => $exception->getMessage(),
        ]);

        return $this->response->setStatusCode(ResponseInterface::HTTP_CONFLICT)
            ->setJSON([
                'success' => false,
                'message' => 'The Project BOQ conflicts with existing data or changed during this request.',
            ]);
    }

    public function publicPreview(int $id): ResponseInterface
    {
        try {
            $boq = $this->baseQuery()->find($id);
            if ($boq === null) {
                return $this->notFound('Project BOQ not found.');
            }

            $db = db_connect();
            $sections = $db->table('boq_sections')
                ->where('boq_id', $id)
                ->where('deleted_at', null)
                ->orderBy('sort_order', 'ASC')
                ->orderBy('id', 'ASC')
                ->get()
                ->getResultArray();

            $items = $db->table('boq_items bi')
                ->select('bi.*, u.unit_code, u.unit_name, u.symbol as unit_symbol')
                ->join('units_of_measurement u', 'u.id = bi.uom_id', 'left')
                ->where('bi.boq_id', $id)
                ->where('bi.deleted_at', null)
                ->orderBy('bi.sort_order', 'ASC')
                ->orderBy('bi.id', 'ASC')
                ->get()
                ->getResultArray();

            $boq['sections'] = $sections;
            $boq['items'] = $items;

            return $this->response->setJSON([
                'success' => true,
                'message' => 'Project BOQ preview retrieved successfully.',
                'data' => ['project_boq' => $boq],
            ]);
        } catch (Throwable $exception) {
            return $this->serverError('Project BOQ preview retrieval failed.', $exception);
        }
    }
}

