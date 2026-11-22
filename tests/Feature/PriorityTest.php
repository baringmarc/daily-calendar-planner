<?php

namespace Tests\Feature;

use App\Enums\Priority;
use App\Models\CalendarDay;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Priority is defined once, in App\Enums\Priority. The column default and
 * the frontend constants must agree with it.
 */
class PriorityTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_column_default_is_the_enum_default(): void
    {
        $column = collect(Schema::getColumns('tasks'))->firstWhere('name', 'priority');

        $this->assertSame((string) Priority::DEFAULT->value, trim((string) $column['default'], "'\""));
    }

    public function test_a_row_inserted_without_a_priority_gets_the_enum_default(): void
    {
        $day = CalendarDay::factory()->create();

        DB::table('tasks')->insert([
            'calendar_day_id' => $day->id,
            'description' => 'Raw insert',
            'is_finished' => false,
            'order' => 1,
        ]);

        $this->assertSame(Priority::DEFAULT->value, (int) DB::table('tasks')->value('priority'));
    }

    public function test_the_frontend_constants_match_the_enum(): void
    {
        $source = file_get_contents(resource_path('js/constants/priority.ts'));

        preg_match_all("/\\{\\s*label:\\s*'([^']+)',\\s*value:\\s*(\\d+)/", $source, $matches, PREG_SET_ORDER);

        $this->assertSame(
            collect(Priority::cases())->map(fn (Priority $priority) => [$priority->label(), $priority->value])->all(),
            collect($matches)->map(fn (array $match) => [$match[1], (int) $match[2]])->all(),
            'resources/js/constants/priority.ts is out of sync with App\Enums\Priority.',
        );

        $this->assertMatchesRegularExpression(
            '/PRIORITY_DEFAULT\s*(?::\s*\w+\s*)?=\s*'.Priority::DEFAULT->value.'\b/',
            $source,
            'PRIORITY_DEFAULT in resources/js/constants/priority.ts does not match Priority::DEFAULT.',
        );
    }
}
