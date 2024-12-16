<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Dienst extends Model
{
    use HasFactory;

    protected $table = 'diensten';

    protected $fillable = [
        'factuur_id',
        'dienst',
        'aantal',
        'waarde',
    ];

    public function factuur()
    {
        return $this->belongsTo(Factuur::class, 'factuur_id');
    }
}
