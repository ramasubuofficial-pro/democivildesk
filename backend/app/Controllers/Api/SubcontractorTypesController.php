<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use CodeIgniter\HTTP\ResponseInterface;

class SubcontractorTypesController extends SubcontractApiController
{
    private string $table = 'subcontractors_contractor_type_masters';

    public function index(): ResponseInterface
    {
        $user = $this->user();
        if (!$user) {
            return $this->unauthorized();
        }

        $includeInactive = filter_var(
            $this->request->getGet('include_inactive') ?? false,
            FILTER_VALIDATE_BOOLEAN
        );

        $builder = db_connect()
            ->table($this->table)
            ->orderBy('sort_order', 'ASC')
            ->orderBy('contractor_type_name', 'ASC');

        if (!$includeInactive) {
            $builder->where('is_active', 1);
        }

        return $this->ok(
            'Subcontractor types retrieved successfully.',
            'contractor_types',
            $builder->get()->getResultArray()
        );
    }

    public function show(int $id): ResponseInterface
    {
        $user = $this->user();
        if (!$user) {
            return $this->unauthorized();
        }

        $row = db_connect()->table($this->table)->where('id', $id)->get()->getRowArray();
        if (!$row) {
            return $this->missing('Subcontractor type not found.');
        }

        return $this->ok('Subcontractor type retrieved successfully.', 'contractor_type', $row);
    }

    public function create(): ResponseInterface
    {
        return $this->save(null);
    }

    public function update(int $id): ResponseInterface
    {
        return $this->save($id);
    }

    public function delete(int $id): ResponseInterface
    {
        $user = $this->user();
        if (!$user) {
            return $this->unauthorized();
        }

        $db = db_connect();
        $row = $db->table($this->table)->where('id', $id)->get()->getRowArray();
        if (!$row) {
            return $this->missing('Subcontractor type not found.');
        }

        if ((int) $row['is_active'] === 0) {
            return $this->ok('Subcontractor type is already inactive.', 'contractor_type', $row);
        }

        $db->table($this->table)
            ->where('id', $id)
            ->update([
                'is_active'  => 0,
                'updated_at' => $this->now(),
            ]);

        $updated = $db->table($this->table)->where('id', $id)->get()->getRowArray();

        return $this->ok(
            'Subcontractor type deactivated successfully.',
            'contractor_type',
            $updated
        );
    }

    private function save(?int $id): ResponseInterface
    {
        $user = $this->user();
        if (!$user) {
            return $this->unauthorized();
        }

        $input = $this->input();
        if ($input === null) {
            return $this->invalid(['body' => 'A valid JSON body is required.']);
        }

        $db = db_connect();
        $old = $id
            ? $db->table($this->table)->where('id', $id)->get()->getRowArray()
            : null;

        if ($id && !$old) {
            return $this->missing('Subcontractor type not found.');
        }

        $allowed = [
            'contractor_type_code',
            'contractor_type_name',
            'sort_order',
            'is_active',
        ];

        $data = array_intersect_key($input, array_flip($allowed));
        $merged = array_merge($old ?? [], $data);

        $errors = $this->required($merged, ['contractor_type_code', 'contractor_type_name']);

        $code = strtoupper(trim((string) ($merged['contractor_type_code'] ?? '')));
        $name = trim((string) ($merged['contractor_type_name'] ?? ''));

        if ($code !== '' && !preg_match('/^[A-Z0-9_\-]+$/', $code)) {
            $errors['contractor_type_code'] = 'Use only letters, numbers, underscore or hyphen.';
        }

        if ($name !== '' && mb_strlen($name) > 120) {
            $errors['contractor_type_name'] = 'Maximum 120 characters allowed.';
        }

        $duplicateCode = $db->table($this->table)->where('contractor_type_code', $code);
        if ($id) {
            $duplicateCode->where('id !=', $id);
        }
        if ($code !== '' && $duplicateCode->countAllResults() > 0) {
            $errors['contractor_type_code'] = 'Contractor type code already exists.';
        }

        $duplicateName = $db->table($this->table)->where('contractor_type_name', $name);
        if ($id) {
            $duplicateName->where('id !=', $id);
        }
        if ($name !== '' && $duplicateName->countAllResults() > 0) {
            $errors['contractor_type_name'] = 'Contractor type name already exists.';
        }

        if ($errors) {
            return $this->invalid($errors);
        }

        $data['contractor_type_code'] = $code;
        $data['contractor_type_name'] = $name;
        $data['sort_order'] = isset($merged['sort_order']) ? max(0, (int) $merged['sort_order']) : 0;
        $data['is_active'] = isset($merged['is_active']) ? ((int) $merged['is_active'] === 1 ? 1 : 0) : 1;
        $data['updated_at'] = $this->now();

        if ($id) {
            $db->table($this->table)->where('id', $id)->update($data);
        } else {
            $data['created_at'] = $this->now();
            $db->table($this->table)->insert($data);
            $id = (int) $db->insertID();
        }

        $saved = $db->table($this->table)->where('id', $id)->get()->getRowArray();

        return $this->ok(
            $old ? 'Subcontractor type updated successfully.' : 'Subcontractor type created successfully.',
            'contractor_type',
            $saved,
            $old ? 200 : 201
        );
    }
}
