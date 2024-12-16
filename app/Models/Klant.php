<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Klant extends Model
{
    use HasFactory;

    protected $table = 'klanten';

    protected $fillable = [
        'voornaam',
        'achternaam',
        'adres',
        'postcode',
        'woonplaats',
        'email',
        'telefoon',
        'website',
    ];

    public function facturen()
    {
        return $this->hasMany(Factuur::class, 'klant_id');
    }
}
