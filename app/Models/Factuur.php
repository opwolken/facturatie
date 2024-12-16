<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Factuur extends Model
{
    use HasFactory;

    protected $table = 'facturen';

    protected $fillable = [
        'factuurnummer',
        'factuurdatum',
        'onderwerp',
        'factuur_van',
        'status',
        'klant_id',
        'crediteur_id',
        'percentage',
        'subtotaal',
        'btw_percentage',
        'btw',
        'totaal',
        'bijlage',
    ];

    public function klant()
    {
        return $this->belongsTo(Klant::class, 'klant_id');
    }

    public function crediteur()
    {
        return $this->belongsTo(Crediteur::class, 'crediteur_id');
    }

    public function diensten()
    {
        return $this->hasMany(Dienst::class, 'factuur_id');
    }
}
