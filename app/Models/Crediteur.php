<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Crediteur extends Model
{
    use HasFactory;

    protected $table = 'crediteuren';

    protected $fillable = [
        'naam',
    ];

    public function facturen()
    {
        return $this->hasMany(Factuur::class, 'crediteur_id');
    }
}
