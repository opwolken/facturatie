<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCrediteurenTable extends Migration
{
    public function up()
    {
        Schema::create('crediteuren', function (Blueprint $table) {
            $table->id(); // crediteur_id
            $table->string('naam');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('crediteuren');
    }
}
