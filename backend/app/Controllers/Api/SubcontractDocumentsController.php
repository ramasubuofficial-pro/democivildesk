<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use CodeIgniter\Database\BaseBuilder;
use CodeIgniter\HTTP\ResponseInterface;

class SubcontractDocumentsController extends SubcontractApiController
{
    private array $cfg = [
        'work-orders' => [
            'table' => 'subcontract_work_orders',
            'items' => 'subcontract_work_order_items',
            'fk' => 'work_order_id',
            'key' => 'work_order',
            'list' => 'work_orders',
            'no' => 'work_order_no',
            'status' => 'subcontract_work_orders_status_masters',
            'statusCol' => 'status_code',
            'entity' => 'WORK_ORDER',
            'required' => ['project_id', 'contractor_id', 'work_order_no', 'work_order_date', 'scope_of_work'],
            'fields' => [
                'project_id', 'site_id', 'work_zone_id', 'contractor_id', 'work_order_no',
                'work_order_date', 'start_date', 'completion_date', 'scope_of_work', 'currency_code',
                'total_order_value', 'variation_amount', 'retention_percent', 'advance_amount',
                'payment_terms', 'terms_and_conditions',
            ],
        ],
        'measurements' => [
            'table' => 'subcontract_measurements',
            'items' => 'subcontract_measurement_lines',
            'fk' => 'measurement_id',
            'key' => 'measurement',
            'list' => 'measurements',
            'no' => 'measurement_no',
            'status' => 'subcontract_measurements_status_masters',
            'statusCol' => 'status_code',
            'entity' => 'MEASUREMENT',
            'required' => ['project_id', 'work_order_id', 'measurement_no', 'measurement_date'],
            'fields' => [
                'project_id', 'work_order_id', 'site_id', 'work_zone_id', 'measurement_no',
                'measurement_date', 'period_from', 'period_to', 'measured_by',
                'contractor_representative', 'remarks',
            ],
        ],
        'ra-bills' => [
            'table' => 'subcontract_ra_bills',
            'items' => 'subcontract_ra_bill_items',
            'fk' => 'ra_bill_id',
            'key' => 'ra_bill',
            'list' => 'ra_bills',
            'no' => 'ra_bill_no',
            'status' => 'subcontract_ra_bills_status_masters',
            'statusCol' => 'status_code',
            'entity' => 'RA_BILL',
            'required' => ['project_id', 'work_order_id', 'contractor_id', 'ra_bill_no', 'bill_date'],
            'fields' => [
                'project_id', 'work_order_id', 'contractor_id', 'ra_bill_no', 'contractor_bill_no',
                'bill_date', 'period_from', 'period_to', 'due_date', 'variation_value',
                'material_recovery', 'advance_recovery', 'retention_amount', 'other_recovery',
                'cgst_amount', 'sgst_amount', 'igst_amount', 'tds_amount', 'remarks',
            ],
        ],
        'payments' => [
            'table' => 'subcontract_payments',
            'items' => null,
            'fk' => null,
            'key' => 'payment',
            'list' => 'payments',
            'no' => 'payment_no',
            'status' => 'subcontract_payments_status_masters',
            'statusCol' => 'status_code',
            'entity' => 'PAYMENT',
            'required' => [
                'project_id', 'ra_bill_id', 'contractor_id', 'payment_no',
                'payment_date', 'payment_mode_id', 'amount',
            ],
            'fields' => [
                'project_id', 'ra_bill_id', 'contractor_id', 'payment_no', 'payment_date',
                'payment_mode_id', 'reference_no', 'amount', 'remarks',
            ],
        ],
    ];

    public function index(string $type): ResponseInterface
    {
        $user = $this->user();
        if (!$user) {
            return $this->unauthorized();
        }

        $cfg = $this->cfg[$type] ?? null;
        if (!$cfg) {
            return $this->missing();
        }

        $builder = $this->documentBuilder($type, $this->company($user));

        $filterFields = [
            'work-orders' => ['project_id', 'contractor_id', 'status_id'],
            'measurements' => ['project_id', 'contractor_id', 'work_order_id', 'status_id'],
            'ra-bills' => ['project_id', 'contractor_id', 'work_order_id', 'status_id'],
            'payments' => ['project_id', 'contractor_id', 'ra_bill_id', 'status_id'],
        ];

        foreach ($filterFields[$type] as $field) {
            $value = $this->request->getGet($field);
            if (ctype_digit((string) $value)) {
                if ($type === 'measurements' && $field === 'contractor_id') {
                    $builder->where('wo.contractor_id', (int) $value);
                } else {
                    $builder->where('d.' . $field, (int) $value);
                }
            }
        }

        $rows = $builder->orderBy('d.id', 'DESC')->get()->getResultArray();

        return $this->ok(
            ucwords(str_replace('-', ' ', $type)) . ' retrieved successfully.',
            $cfg['list'],
            $rows
        );
    }

    public function show(string $type, int $id): ResponseInterface
    {
        $user = $this->user();
        if (!$user) {
            return $this->unauthorized();
        }

        $cfg = $this->cfg[$type] ?? null;
        if (!$cfg) {
            return $this->missing();
        }

        $companyId = $this->company($user);
        $row = $this->documentRow($type, $id, $companyId);
        if (!$row || !$this->project((int) $row['project_id'], $user)) {
            return $this->missing();
        }

        if ($cfg['items']) {
            $row['items'] = db_connect()
                ->table($cfg['items'])
                ->where([$cfg['fk'] => $id, 'company_id' => $companyId])
                ->where('deleted_at', null)
                ->orderBy('id')
                ->get()
                ->getResultArray();
        }

        $entityTypeId = $this->masterId(
            'subcontract_status_logs_entity_type_masters',
            'entity_type_code',
            $cfg['entity']
        );

        $row['status_logs'] = $entityTypeId
            ? db_connect()->table('subcontract_status_logs')
                ->where([
                    'company_id' => $companyId,
                    'entity_type_id' => $entityTypeId,
                    'entity_id' => $id,
                ])
                ->orderBy('id')
                ->get()
                ->getResultArray()
            : [];

        return $this->ok(
            ucwords(str_replace('_', ' ', $cfg['key'])) . ' retrieved successfully.',
            $cfg['key'],
            $row
        );
    }

    public function create(string $type): ResponseInterface
    {
        return $this->save($type, null);
    }

    public function update(string $type, int $id): ResponseInterface
    {
        return $this->save($type, $id);
    }

    public function delete(string $type, int $id): ResponseInterface
    {
        $user = $this->user();
        if (!$user) {
            return $this->unauthorized();
        }

        $cfg = $this->cfg[$type] ?? null;
        if (!$cfg) {
            return $this->missing();
        }

        $companyId = $this->company($user);
        $row = $this->row($cfg['table'], $id, $companyId);
        if (!$row || !$this->project((int) $row['project_id'], $user, true)) {
            return $this->missing();
        }

        $statusCode = $this->code($cfg['status'], $cfg['statusCol'], (int) $row['status_id']);
        if (!in_array($statusCode, ['DRAFT', 'REJECTED', 'CANCELLED'], true)) {
            return $this->conflict(
                'Only DRAFT, REJECTED or CANCELLED ' . str_replace('_', ' ', $cfg['key']) . ' records can be deleted.'
            );
        }

        $dependencyError = $this->deleteDependencyError($type, $id, $companyId);
        if ($dependencyError !== null) {
            return $this->conflict($dependencyError);
        }

        $db = db_connect();
        $db->transBegin();

        $now = $this->now();
        $db->table($cfg['table'])->where('id', $id)->where('company_id', $companyId)->update([
            'deleted_at' => $now,
            'updated_by' => (int) $user->id,
            'updated_at' => $now,
        ]);

        if ($cfg['items']) {
            $db->table($cfg['items'])
                ->where($cfg['fk'], $id)
                ->where('company_id', $companyId)
                ->where('deleted_at', null)
                ->update(['deleted_at' => $now]);
        }

        $this->logStatus(
            $cfg['entity'],
            $id,
            $statusCode,
            'DELETED',
            'STATUS_CHANGED',
            $companyId,
            (int) $user->id,
            'Soft deleted from subcontract module.'
        );

        if ($db->transStatus() === false) {
            $db->transRollback();
            return $this->response->setStatusCode(500)->setJSON([
                'success' => false,
                'message' => 'Unable to delete subcontract record.',
            ]);
        }

        $db->transCommit();

        return $this->ok(
            ucwords(str_replace('_', ' ', $cfg['key'])) . ' deleted successfully.',
            $cfg['key'],
            ['id' => $id, 'deleted_at' => $now]
        );
    }

    private function save(string $type, ?int $id): ResponseInterface
    {
        $user = $this->user();
        if (!$user) {
            return $this->unauthorized();
        }

        $cfg = $this->cfg[$type] ?? null;
        if (!$cfg) {
            return $this->missing();
        }

        $input = $this->input();
        if ($input === null) {
            return $this->invalid(['body' => 'A valid JSON body is required.']);
        }

        $companyId = $this->company($user);
        $old = $id ? $this->row($cfg['table'], $id, $companyId) : null;

        if ($id && !$old) {
            return $this->missing();
        }

        if ($old && $this->code($cfg['status'], $cfg['statusCol'], (int) $old['status_id']) !== 'DRAFT') {
            return $this->conflict('Only DRAFT records can be updated.');
        }

        $data = array_intersect_key($input, array_flip($cfg['fields']));
        $merged = array_merge($old ?? [], $data);
        $errors = $this->required($merged, $cfg['required']);

        if (!$this->project((int) ($merged['project_id'] ?? 0), $user, true)) {
            $errors['project_id'] = 'Select an accessible project.';
        }

        if (!$this->validSite(
            isset($merged['site_id']) ? (int) $merged['site_id'] : null,
            (int) ($merged['project_id'] ?? 0),
            $companyId
        )) {
            $errors['site_id'] = 'Select a site belonging to the project.';
        }

        if (!$this->validZone(
            isset($merged['work_zone_id']) ? (int) $merged['work_zone_id'] : null,
            isset($merged['site_id']) ? (int) $merged['site_id'] : null,
            $companyId
        )) {
            $errors['work_zone_id'] = 'Select a zone belonging to the site.';
        }

        if (isset($merged['contractor_id']) && !$this->row('subcontractors', (int) $merged['contractor_id'], $companyId)) {
            $errors['contractor_id'] = 'Select a valid subcontractor.';
        }

        if (isset($merged['work_order_id'])) {
            $workOrder = $this->row('subcontract_work_orders', (int) $merged['work_order_id'], $companyId);
            if (
                !$workOrder
                || (int) $workOrder['project_id'] !== (int) $merged['project_id']
                || (
                    isset($merged['contractor_id'])
                    && (int) $workOrder['contractor_id'] !== (int) $merged['contractor_id']
                )
            ) {
                $errors['work_order_id'] = 'Select a matching project work order.';
            }
        }

        if (isset($merged['ra_bill_id'])) {
            $bill = $this->row('subcontract_ra_bills', (int) $merged['ra_bill_id'], $companyId);
            if (
                !$bill
                || (int) $bill['project_id'] !== (int) $merged['project_id']
                || (int) $bill['contractor_id'] !== (int) $merged['contractor_id']
            ) {
                $errors['ra_bill_id'] = 'Select a matching certified RA bill.';
            }
        }

        if (isset($merged['payment_mode_id'])) {
            $paymentModeExists = db_connect()->table('subcontract_payments_payment_mode_masters')
                ->where(['id' => (int) $merged['payment_mode_id'], 'is_active' => 1])
                ->countAllResults() > 0;
            if (!$paymentModeExists) {
                $errors['payment_mode_id'] = 'Select a valid payment mode.';
            }
        }

        $duplicate = db_connect()->table($cfg['table'])
            ->where(['company_id' => $companyId, $cfg['no'] => $merged[$cfg['no']] ?? ''])
            ->where('deleted_at', null);
        if ($id) {
            $duplicate->where('id !=', $id);
        }
        if ($duplicate->countAllResults()) {
            $errors[$cfg['no']] = 'Number already exists.';
        }

        if ($type === 'work-orders' && array_key_exists('total_order_value', $input)) {
            if (!is_numeric($input['total_order_value']) || (float) $input['total_order_value'] < 0) {
                $errors['total_order_value'] = 'Total order value must be zero or greater.';
            }
        }

        if ($errors) {
            return $this->invalid($errors);
        }

        $draftId = $this->masterId($cfg['status'], $cfg['statusCol'], 'DRAFT');
        $data += [
            'status_id' => $old['status_id'] ?? $draftId,
            'updated_by' => (int) $user->id,
            'updated_at' => $this->now(),
        ];

        // Support both professional WO modes without changing the DB:
        // 1) Lump-sum WO: header total_order_value is authoritative while there are no item lines.
        // 2) Item-rate WO: item lines recalculate subtotal/tax/total automatically.
        if ($type === 'work-orders') {
            $itemCount = $id
                ? db_connect()->table('subcontract_work_order_items')
                    ->where(['work_order_id' => $id, 'company_id' => $companyId])
                    ->where('deleted_at', null)
                    ->countAllResults()
                : 0;

            if ($itemCount > 0) {
                unset($data['total_order_value']);
                if (array_key_exists('variation_amount', $data)) {
                    $baseTotal = (float) ($old['total_order_value'] ?? 0);
                    $data['revised_order_value'] = $baseTotal + (float) $data['variation_amount'];
                }
            } elseif (array_key_exists('total_order_value', $input)) {
                $total = round((float) $input['total_order_value'], 2);
                $variation = (float) ($data['variation_amount'] ?? $old['variation_amount'] ?? 0);
                $data['subtotal'] = $total;
                $data['tax_amount'] = 0.00;
                $data['total_order_value'] = $total;
                $data['revised_order_value'] = round($total + $variation, 2);
            } elseif (array_key_exists('variation_amount', $data)) {
                $baseTotal = (float) ($old['total_order_value'] ?? 0);
                $data['revised_order_value'] = round($baseTotal + (float) $data['variation_amount'], 2);
            }
        }

        $db = db_connect();
        if ($id) {
            $db->table($cfg['table'])->where('id', $id)->where('company_id', $companyId)->update($data);
        } else {
            $data += [
                'company_id' => $companyId,
                'created_by' => (int) $user->id,
                'created_at' => $this->now(),
            ];

            if ($type === 'ra-bills') {
                $data['payment_status_id'] = $this->masterId(
                    'subcontract_ra_bills_payment_status_masters',
                    'payment_status_code',
                    'UNPAID'
                );
            }

            $db->table($cfg['table'])->insert($data);
            $id = (int) $db->insertID();
            $this->logStatus($cfg['entity'], $id, null, 'DRAFT', 'CREATED', $companyId, (int) $user->id, null);
        }

        return $this->show($type, $id);
    }

    public function addItem(string $type, int $id): ResponseInterface
    {
        return $this->saveItem($type, $id, null);
    }

    public function updateItem(string $type, int $id, int $item): ResponseInterface
    {
        return $this->saveItem($type, $id, $item);
    }

    private function saveItem(string $type, int $id, ?int $item): ResponseInterface
    {
        $user = $this->user();
        if (!$user) {
            return $this->unauthorized();
        }

        $cfg = $this->cfg[$type] ?? null;
        if (!$cfg || !$cfg['items']) {
            return $this->missing();
        }

        $companyId = $this->company($user);
        $header = $this->row($cfg['table'], $id, $companyId);
        if (!$header) {
            return $this->missing();
        }

        if ($this->code($cfg['status'], $cfg['statusCol'], (int) $header['status_id']) !== 'DRAFT') {
            return $this->conflict('Items can be changed only in DRAFT.');
        }

        $input = $this->input() ?? [];
        $old = $item ? $this->row($cfg['items'], $item, $companyId) : null;
        if ($item && (!$old || (int) $old[$cfg['fk']] !== $id)) {
            return $this->missing();
        }

        if ($type === 'work-orders') {
            $fields = [
                'boq_item_id', 'budget_line_id', 'uom_id', 'item_code', 'description',
                'ordered_quantity', 'rate', 'tax_percent', 'display_order', 'notes',
            ];
            $required = ['uom_id', 'item_code', 'description', 'ordered_quantity', 'rate'];
        } elseif ($type === 'measurements') {
            $fields = [
                'work_order_item_id', 'description', 'location_reference', 'length_value',
                'breadth_value', 'height_value', 'number_count', 'measured_quantity',
                'accepted_quantity', 'rate', 'remarks',
            ];
            $required = ['work_order_item_id', 'measured_quantity', 'accepted_quantity', 'rate'];
        } else {
            $fields = [
                'work_order_item_id', 'measurement_line_id', 'budget_line_id', 'description',
                'current_quantity', 'rate', 'certified_amount', 'remarks',
            ];
            $required = ['work_order_item_id', 'description', 'current_quantity', 'rate'];
        }

        $data = array_intersect_key($input, array_flip($fields));
        $merged = array_merge($old ?? [], $data);
        $errors = $this->required($merged, $required);

        $workOrderItem = $this->row(
            'subcontract_work_order_items',
            (int) ($merged['work_order_item_id'] ?? 0),
            $companyId
        );

        if (
            $type !== 'work-orders'
            && (!$workOrderItem || (int) $workOrderItem['work_order_id'] !== (int) $header['work_order_id'])
        ) {
            $errors['work_order_item_id'] = 'Select an item from this work order.';
        }

        if (
            $type === 'work-orders'
            && !empty($merged['boq_item_id'])
            && !db_connect()->table('boq_items')
                ->where([
                    'id' => (int) $merged['boq_item_id'],
                    'company_id' => $companyId,
                    'project_id' => (int) $header['project_id'],
                ])
                ->where('deleted_at', null)
                ->countAllResults()
        ) {
            $errors['boq_item_id'] = 'Select a BOQ item from this project.';
        }

        if ($errors) {
            return $this->invalid($errors);
        }

        if ($type === 'work-orders') {
            $data['amount'] = round((float) $merged['ordered_quantity'] * (float) $merged['rate'], 2);
        } elseif ($type === 'measurements') {
            $previous = (float) (
                db_connect()->table('subcontract_measurement_lines ml')
                    ->selectSum('accepted_quantity')
                    ->join('subcontract_measurements mh', 'mh.id=ml.measurement_id')
                    ->where('ml.work_order_item_id', (int) $merged['work_order_item_id'])
                    ->whereIn('mh.status_id', array_filter([
                        $this->masterId('subcontract_measurements_status_masters', 'status_code', 'APPROVED'),
                    ]))
                    ->where('ml.deleted_at', null)
                    ->where('mh.deleted_at', null)
                    ->get()
                    ->getRowArray()['accepted_quantity'] ?? 0
            );

            $data += [
                'previous_quantity' => $previous,
                'cumulative_quantity' => $previous + (float) $merged['accepted_quantity'],
                'measured_amount' => round((float) $merged['accepted_quantity'] * (float) $merged['rate'], 2),
            ];
        } else {
            $previous = (float) (
                db_connect()->table('subcontract_ra_bill_items bi')
                    ->selectSum('current_quantity')
                    ->join('subcontract_ra_bills bh', 'bh.id=bi.ra_bill_id')
                    ->where('bi.work_order_item_id', (int) $merged['work_order_item_id'])
                    ->whereIn('bh.status_id', array_filter([
                        $this->masterId('subcontract_ra_bills_status_masters', 'status_code', 'CERTIFIED'),
                    ]))
                    ->where('bi.deleted_at', null)
                    ->where('bh.deleted_at', null)
                    ->get()
                    ->getRowArray()['current_quantity'] ?? 0
            );

            $data += [
                'previous_quantity' => $previous,
                'cumulative_quantity' => $previous + (float) $merged['current_quantity'],
                'current_amount' => round((float) $merged['current_quantity'] * (float) $merged['rate'], 2),
                'certified_amount' => $merged['certified_amount']
                    ?? round((float) $merged['current_quantity'] * (float) $merged['rate'], 2),
            ];
        }

        $data += [
            'company_id' => $companyId,
            'project_id' => (int) $header['project_id'],
            $cfg['fk'] => $id,
            'created_by' => (int) $user->id,
        ];

        $db = db_connect();
        if ($item) {
            $db->table($cfg['items'])->where('id', $item)->where('company_id', $companyId)->update(
                array_diff_key($data, array_flip(['company_id', 'project_id', $cfg['fk'], 'created_by']))
            );
        } else {
            $data['created_at'] = $this->now();
            $db->table($cfg['items'])->insert($data);
            $item = (int) $db->insertID();
        }

        $this->recalc($type, $id);

        return $this->ok(
            'Item saved successfully.',
            'item',
            $this->row($cfg['items'], $item, $companyId),
            $old ? 200 : 201
        );
    }

    private function recalc(string $type, int $id): void
    {
        $cfg = $this->cfg[$type];
        $db = db_connect();

        if ($type === 'work-orders') {
            $totals = $db->table($cfg['items'])
                ->select('SUM(amount) subtotal,SUM(amount*tax_percent/100) tax', false)
                ->where($cfg['fk'], $id)
                ->where('deleted_at', null)
                ->get()
                ->getRowArray();

            $subtotal = round((float) ($totals['subtotal'] ?? 0), 2);
            $tax = round((float) ($totals['tax'] ?? 0), 2);
            $workOrder = $db->table($cfg['table'])->where('id', $id)->get()->getRowArray();

            $db->table($cfg['table'])->where('id', $id)->update([
                'subtotal' => $subtotal,
                'tax_amount' => $tax,
                'total_order_value' => $subtotal + $tax,
                'revised_order_value' => $subtotal + $tax + (float) ($workOrder['variation_amount'] ?? 0),
            ]);
        } elseif ($type === 'measurements') {
            $sum = (float) (
                $db->table($cfg['items'])
                    ->selectSum('measured_amount')
                    ->where($cfg['fk'], $id)
                    ->where('deleted_at', null)
                    ->get()
                    ->getRowArray()['measured_amount'] ?? 0
            );

            $db->table($cfg['table'])->where('id', $id)->update(['total_measured_amount' => $sum]);
        } else {
            $sum = (float) (
                $db->table($cfg['items'])
                    ->selectSum('certified_amount')
                    ->where($cfg['fk'], $id)
                    ->where('deleted_at', null)
                    ->get()
                    ->getRowArray()['certified_amount'] ?? 0
            );

            $header = $db->table($cfg['table'])->where('id', $id)->get()->getRowArray();
            $taxable = $sum
                + (float) $header['variation_value']
                - (float) $header['material_recovery']
                - (float) $header['advance_recovery']
                - (float) $header['retention_amount']
                - (float) $header['other_recovery'];
            $gross = $taxable
                + (float) $header['cgst_amount']
                + (float) $header['sgst_amount']
                + (float) $header['igst_amount'];
            $net = $gross - (float) $header['tds_amount'];

            $db->table($cfg['table'])->where('id', $id)->update([
                'gross_work_value' => $sum,
                'taxable_amount' => $taxable,
                'gross_bill_amount' => $gross,
                'net_certified_amount' => $net,
                'outstanding_amount' => $net - (float) $header['paid_amount'],
            ]);
        }
    }

    public function action(string $type, int $id, string $action): ResponseInterface
    {
        $user = $this->user();
        if (!$user) {
            return $this->unauthorized();
        }

        $cfg = $this->cfg[$type] ?? null;
        if (!$cfg) {
            return $this->missing();
        }

        $companyId = $this->company($user);
        $row = $this->row($cfg['table'], $id, $companyId);
        if (!$row || !$this->project((int) $row['project_id'], $user, true)) {
            return $this->missing();
        }

        $oldStatus = $this->code($cfg['status'], $cfg['statusCol'], (int) $row['status_id']);

        $map = [
            'work-orders' => [
                'submit' => ['DRAFT', 'SUBMITTED'],
                'approve' => ['SUBMITTED', 'APPROVED'],
                'return' => [['SUBMITTED', 'APPROVED'], 'DRAFT'],
                'reject' => ['SUBMITTED', 'REJECTED'],
                'activate' => ['APPROVED', 'ACTIVE'],
                'complete' => ['ACTIVE', 'COMPLETED'],
                'close' => ['COMPLETED', 'CLOSED'],
                'cancel' => [['DRAFT', 'SUBMITTED', 'APPROVED'], 'CANCELLED'],
            ],
            'measurements' => [
                'submit' => ['DRAFT', 'SUBMITTED'],
                'verify' => ['SUBMITTED', 'VERIFIED'],
                'approve' => ['VERIFIED', 'APPROVED'],
                'reject' => [['SUBMITTED', 'VERIFIED'], 'REJECTED'],
                'cancel' => [['DRAFT', 'SUBMITTED'], 'CANCELLED'],
            ],
            'ra-bills' => [
                'submit' => ['DRAFT', 'SUBMITTED'],
                'verify' => ['SUBMITTED', 'VERIFIED'],
                'approve' => ['VERIFIED', 'APPROVED'],
                'return' => [['SUBMITTED', 'VERIFIED', 'APPROVED'], 'DRAFT'],
                'certify' => ['APPROVED', 'CERTIFIED'],
                'reject' => [['SUBMITTED', 'VERIFIED', 'APPROVED'], 'REJECTED'],
                'cancel' => [['DRAFT', 'SUBMITTED'], 'CANCELLED'],
            ],
            'payments' => [
                'submit' => ['DRAFT', 'SUBMITTED'],
                'approve' => ['SUBMITTED', 'APPROVED'],
                'mark-paid' => ['APPROVED', 'PAID'],
                'reject' => ['SUBMITTED', 'REJECTED'],
                'cancel' => [['DRAFT', 'SUBMITTED', 'APPROVED'], 'CANCELLED'],
            ],
        ];

        $transition = $map[$type][$action] ?? null;
        if (!$transition) {
            return $this->missing('Unsupported workflow action.');
        }

        $fromStatuses = (array) $transition[0];
        $newStatus = $transition[1];
        if (!in_array($oldStatus, $fromStatuses, true)) {
            return $this->conflict("Cannot {$action} {$cfg['key']} from {$oldStatus}.");
        }

        if ($cfg['items'] && in_array($action, ['submit', 'verify', 'approve', 'certify'], true)) {
            $itemCount = db_connect()->table($cfg['items'])
                ->where($cfg['fk'], $id)
                ->where('deleted_at', null)
                ->countAllResults();

            $lumpSumWorkOrder = $type === 'work-orders' && (float) ($row['total_order_value'] ?? 0) > 0;
            if ($itemCount === 0 && !$lumpSumWorkOrder) {
                return $this->invalid(['items' => 'At least one item is required.']);
            }
        }

        $statusId = $this->masterId($cfg['status'], $cfg['statusCol'], $newStatus);
        if (!$statusId) {
            return $this->response->setStatusCode(500)->setJSON([
                'success' => false,
                'message' => 'Required subcontract status master is missing.',
            ]);
        }

        $input = $this->input() ?? [];
        $data = [
            'status_id' => $statusId,
            'updated_by' => (int) $user->id,
            'updated_at' => $this->now(),
        ];

        $stamp = [
            'work-orders' => [
                'submit' => ['submitted_by', 'submitted_at'],
                'approve' => ['approved_by', 'approved_at'],
            ],
            'measurements' => [
                'verify' => ['verified_by', 'verified_at'],
                'approve' => ['approved_by', 'approved_at'],
            ],
            'ra-bills' => [
                'submit' => ['submitted_by', 'submitted_at'],
                'verify' => ['verified_by', 'verified_at'],
                'certify' => ['certified_by', 'certified_at'],
            ],
            'payments' => [
                'submit' => ['submitted_by', 'submitted_at'],
                'approve' => ['approved_by', 'approved_at'],
                'mark-paid' => ['paid_by', 'paid_at'],
            ],
        ];

        if (isset($stamp[$type][$action])) {
            $data[$stamp[$type][$action][0]] = (int) $user->id;
            $data[$stamp[$type][$action][1]] = $this->now();
        }

        // A return-for-revision deliberately reopens the same document as DRAFT.
        // Existing DB status masters remain unchanged; no new RETURNED status/table is required.
        if ($action === 'return') {
            if ($type === 'work-orders') {
                $data += [
                    'submitted_by' => null,
                    'submitted_at' => null,
                    'approved_by' => null,
                    'approved_at' => null,
                ];
            } elseif ($type === 'ra-bills') {
                $data += [
                    'submitted_by' => null,
                    'submitted_at' => null,
                    'verified_by' => null,
                    'verified_at' => null,
                    'certified_by' => null,
                    'certified_at' => null,
                ];
            }
        }

        $db = db_connect();
        $db->transBegin();
        $db->table($cfg['table'])->where('id', $id)->where('company_id', $companyId)->update($data);

        if ($type === 'measurements' && $newStatus === 'APPROVED') {
            foreach (
                $db->table('subcontract_measurement_lines')
                    ->where('measurement_id', $id)
                    ->where('deleted_at', null)
                    ->get()
                    ->getResultArray() as $line
            ) {
                $db->table('subcontract_work_order_items')
                    ->where('id', $line['work_order_item_id'])
                    ->set('completed_quantity', 'completed_quantity+' . (float) $line['accepted_quantity'], false)
                    ->update();
            }
        }

        if ($type === 'ra-bills' && $newStatus === 'CERTIFIED') {
            foreach (
                $db->table('subcontract_ra_bill_items')
                    ->where('ra_bill_id', $id)
                    ->where('deleted_at', null)
                    ->get()
                    ->getResultArray() as $line
            ) {
                $db->table('subcontract_work_order_items')
                    ->where('id', $line['work_order_item_id'])
                    ->set('certified_quantity', 'certified_quantity+' . (float) $line['current_quantity'], false)
                    ->update();
            }

            $db->table('subcontract_work_orders')
                ->where('id', $row['work_order_id'])
                ->set('certified_amount', 'certified_amount+' . (float) $row['net_certified_amount'], false)
                ->update();
        }

        if ($type === 'payments' && $newStatus === 'PAID') {
            $bill = $this->row('subcontract_ra_bills', (int) $row['ra_bill_id'], $companyId);
            if (!$bill) {
                $db->transRollback();
                return $this->missing('Linked RA bill not found.');
            }

            $paidAmount = (float) $bill['paid_amount'] + (float) $row['amount'];
            $outstanding = max(0, (float) $bill['net_certified_amount'] - $paidAmount);
            $paymentStatusId = $this->masterId(
                'subcontract_ra_bills_payment_status_masters',
                'payment_status_code',
                $outstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID'
            );

            $db->table('subcontract_ra_bills')->where('id', $bill['id'])->update([
                'paid_amount' => $paidAmount,
                'outstanding_amount' => $outstanding,
                'payment_status_id' => $paymentStatusId,
            ]);

            $db->table('subcontract_work_orders')
                ->where('id', $bill['work_order_id'])
                ->set('paid_amount', 'paid_amount+' . (float) $row['amount'], false)
                ->update();
        }

        $this->logStatus(
            $cfg['entity'],
            $id,
            $oldStatus,
            $newStatus,
            strtoupper(str_replace('-', '_', $action)),
            $companyId,
            (int) $user->id,
            $input['remarks'] ?? null
        );

        if ($db->transStatus() === false) {
            $db->transRollback();
            return $this->response->setStatusCode(500)->setJSON([
                'success' => false,
                'message' => 'Unable to complete subcontract workflow action.',
            ]);
        }

        $db->transCommit();

        $fresh = $this->row($cfg['table'], $id, $companyId);
        if ($fresh && $action !== 'return') {
            $this->notifier->notify(
                $type,
                $fresh,
                strtoupper(str_replace('-', '_', $action)),
                (int) $user->id
            );
        }

        return $this->show($type, $id);
    }

    public function integrations(int $workOrder): ResponseInterface
    {
        $user = $this->user();
        if (!$user) {
            return $this->unauthorized();
        }

        $companyId = $this->company($user);
        $workOrderRow = $this->row('subcontract_work_orders', $workOrder, $companyId);
        if (!$workOrderRow || !$this->project((int) $workOrderRow['project_id'], $user)) {
            return $this->missing();
        }

        $db = db_connect();
        $boqIds = array_column(
            $db->table('subcontract_work_order_items')
                ->select('boq_item_id')
                ->where('work_order_id', $workOrder)
                ->where('deleted_at', null)
                ->where('boq_item_id !=', null)
                ->get()
                ->getResultArray(),
            'boq_item_id'
        );

        $attendance = $db->table('labour_attendance_entries ae')
            ->select('ae.*,ab.attendance_date,ab.project_id,ab.site_id,lw.worker_code,lw.worker_name,lc.contractor_code AS labour_contractor_code,lc.contractor_name AS labour_contractor_name')
            ->join('labour_attendance_batches ab', 'ab.id=ae.batch_id')
            ->join('labour_workers lw', 'lw.id=ae.worker_id AND lw.company_id=ae.company_id')
            ->join('labour_contractors lc', 'lc.id=lw.contractor_id AND lc.company_id=lw.company_id')
            ->where([
                'ae.company_id' => $companyId,
                'ab.project_id' => $workOrderRow['project_id'],
                'lc.subcontractor_id' => $workOrderRow['contractor_id'],
            ]);

        if (!empty($workOrderRow['site_id'])) {
            $attendance->where('ab.site_id', $workOrderRow['site_id']);
        }

        $dailyManpowerBuilder = $db->table('daily_site_manpower m')
            ->select('m.*')
            ->join('daily_site_reports r', 'r.id=m.daily_report_id')
            ->where([
                'm.company_id' => $companyId,
                'r.project_id' => $workOrderRow['project_id'],
            ])
            ->where('m.deleted_at', null);

        if (!empty($workOrderRow['site_id'])) {
            $dailyManpowerBuilder->where('r.site_id', $workOrderRow['site_id']);
        }

        $output = [
            'daily_work_progress' => $boqIds
                ? $db->table('daily_work_progress')
                    ->where('company_id', $companyId)
                    ->whereIn('boq_item_id', $boqIds)
                    ->where('deleted_at', null)
                    ->get()
                    ->getResultArray()
                : [],
            'daily_manpower' => $dailyManpowerBuilder->get()->getResultArray(),
            'labour_attendance' => $attendance->orderBy('ab.attendance_date', 'DESC')->get()->getResultArray(),
            'note' => 'Labour attendance is resolved once through labour_workers.contractor_id -> labour_contractors.subcontractor_id. It is operational evidence only and does not create a second bill or cost.',
        ];

        return $this->ok(
            'Supported Module 5 and Module 7 integrations retrieved successfully.',
            'integrations',
            $output
        );
    }

    private function documentBuilder(string $type, int $companyId): BaseBuilder
    {
        $cfg = $this->cfg[$type];
        $db = db_connect();
        $builder = $db->table($cfg['table'] . ' d')
            ->where('d.company_id', $companyId)
            ->where('d.deleted_at', null);

        if ($type === 'work-orders') {
            $builder
                ->select('d.*,p.project_code,p.project_name,sc.contractor_code,sc.contractor_name,sm.status_code,sm.status_name')
                ->join('projects p', 'p.id=d.project_id AND p.company_id=d.company_id', 'left')
                ->join('subcontractors sc', 'sc.id=d.contractor_id AND sc.company_id=d.company_id', 'left')
                ->join('subcontract_work_orders_status_masters sm', 'sm.id=d.status_id', 'left');
        } elseif ($type === 'measurements') {
            $builder
                ->select('d.*,p.project_code,p.project_name,wo.work_order_no,wo.contractor_id,sc.contractor_code,sc.contractor_name,sm.status_code,sm.status_name')
                ->join('projects p', 'p.id=d.project_id AND p.company_id=d.company_id', 'left')
                ->join('subcontract_work_orders wo', 'wo.id=d.work_order_id AND wo.company_id=d.company_id', 'left')
                ->join('subcontractors sc', 'sc.id=wo.contractor_id AND sc.company_id=d.company_id', 'left')
                ->join('subcontract_measurements_status_masters sm', 'sm.id=d.status_id', 'left');
        } elseif ($type === 'ra-bills') {
            $builder
                ->select('d.*,p.project_code,p.project_name,wo.work_order_no,sc.contractor_code,sc.contractor_name,sm.status_code,sm.status_name,ps.payment_status_code,ps.payment_status_name')
                ->join('projects p', 'p.id=d.project_id AND p.company_id=d.company_id', 'left')
                ->join('subcontract_work_orders wo', 'wo.id=d.work_order_id AND wo.company_id=d.company_id', 'left')
                ->join('subcontractors sc', 'sc.id=d.contractor_id AND sc.company_id=d.company_id', 'left')
                ->join('subcontract_ra_bills_status_masters sm', 'sm.id=d.status_id', 'left')
                ->join('subcontract_ra_bills_payment_status_masters ps', 'ps.id=d.payment_status_id', 'left');
        } else {
            $builder
                ->select('d.*,p.project_code,p.project_name,rb.ra_bill_no,rb.work_order_id,wo.work_order_no,sc.contractor_code,sc.contractor_name,pm.payment_mode_code,pm.payment_mode_name,pm.payment_mode_name AS payment_mode,sm.status_code,sm.status_name')
                ->join('projects p', 'p.id=d.project_id AND p.company_id=d.company_id', 'left')
                ->join('subcontract_ra_bills rb', 'rb.id=d.ra_bill_id AND rb.company_id=d.company_id', 'left')
                ->join('subcontract_work_orders wo', 'wo.id=rb.work_order_id AND wo.company_id=d.company_id', 'left')
                ->join('subcontractors sc', 'sc.id=d.contractor_id AND sc.company_id=d.company_id', 'left')
                ->join('subcontract_payments_payment_mode_masters pm', 'pm.id=d.payment_mode_id', 'left')
                ->join('subcontract_payments_status_masters sm', 'sm.id=d.status_id', 'left');
        }

        return $builder;
    }

    private function documentRow(string $type, int $id, int $companyId): ?array
    {
        $row = $this->documentBuilder($type, $companyId)
            ->where('d.id', $id)
            ->get()
            ->getRowArray();

        return $row ?: null;
    }

    private function deleteDependencyError(string $type, int $id, int $companyId): ?string
    {
        $db = db_connect();

        if ($type === 'work-orders') {
            $hasMeasurements = $db->table('subcontract_measurements')
                ->where(['company_id' => $companyId, 'work_order_id' => $id])
                ->where('deleted_at', null)
                ->countAllResults() > 0;
            $hasBills = $db->table('subcontract_ra_bills')
                ->where(['company_id' => $companyId, 'work_order_id' => $id])
                ->where('deleted_at', null)
                ->countAllResults() > 0;

            if ($hasMeasurements || $hasBills) {
                return 'Work order cannot be deleted because measurements or RA bills already exist.';
            }
        }

        if ($type === 'measurements') {
            $lineIds = array_column(
                $db->table('subcontract_measurement_lines')
                    ->select('id')
                    ->where(['company_id' => $companyId, 'measurement_id' => $id])
                    ->where('deleted_at', null)
                    ->get()
                    ->getResultArray(),
                'id'
            );

            if ($lineIds) {
                $usedInBill = $db->table('subcontract_ra_bill_items')
                    ->where('company_id', $companyId)
                    ->whereIn('measurement_line_id', $lineIds)
                    ->where('deleted_at', null)
                    ->countAllResults() > 0;
                if ($usedInBill) {
                    return 'Measurement cannot be deleted because it is already used in an RA bill.';
                }
            }
        }

        if ($type === 'ra-bills') {
            $hasPayments = $db->table('subcontract_payments')
                ->where(['company_id' => $companyId, 'ra_bill_id' => $id])
                ->where('deleted_at', null)
                ->countAllResults() > 0;
            if ($hasPayments) {
                return 'RA bill cannot be deleted because payment vouchers already exist.';
            }
        }

        return null;
    }
}
