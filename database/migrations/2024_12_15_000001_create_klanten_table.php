<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateKlantenTable extends Migration
{
    public function up()
    {
        Schema::create('klanten', function (Blueprint $table) {
            $table->id(); // klant_id
            $table->string('voornaam')->nullable();
            $table->string('achternaam')->nullable();
            $table->string('adres')->nullable();
            $table->string('postcode')->nullable();
            $table->string('woonplaats')->nullable();
            $table->string('email')->nullable();
            $table->string('telefoon')->nullable();
            $table->string('website')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('klanten');
    }
}
