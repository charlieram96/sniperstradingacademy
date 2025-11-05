/**
 * Academy Content Migration Script
 *
 * This script migrates the hardcoded academy data from the frontend
 * into the academy_modules and academy_lessons database tables.
 *
 * Usage: npx tsx scripts/migrate-academy-content.ts
 */

import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface LessonData {
  id: string
  title: string
  type: "video" | "pdf"
  duration?: string
  size?: string
  url?: string
}

interface ModuleData {
  id: string
  number: number
  title: string
  description: string
  lessons: LessonData[]
}

const hardcodedModules: ModuleData[] = [
  {
    id: "module-1",
    number: 1,
    title: "Introduction",
    description: "Get started with options trading fundamentals",
    lessons: [
      {
        id: "1-1",
        title: "Welcome",
        type: "video",
        duration: "2:13",
        url: "https://faduoctunhntejvbhwqm.supabase.co/storage/v1/object/public/academy-videos/module-1/module-1-1.mp4"
      },
      {
        id: "1-2",
        title: "Snipers Trading Academy Philosophy",
        type: "video",
        duration: "2:41",
        url: "https://faduoctunhntejvbhwqm.supabase.co/storage/v1/object/public/academy-videos/module-1/module-1-2.mp4"
      }
    ]
  },
  {
    id: "module-2",
    number: 2,
    title: "Fundamentals",
    description: "Master the core concepts of options trading",
    lessons: [
      {
        id: "2-1",
        title: "Understanding Calls and Puts",
        type: "video",
        duration: "20 min"
      },
      {
        id: "2-2",
        title: "Options Pricing Basics",
        type: "video",
        duration: "18 min"
      },
      {
        id: "2-3",
        title: "The Greeks Explained",
        type: "video",
        duration: "25 min"
      },
      {
        id: "2-4",
        title: "Options Trading Glossary",
        type: "pdf",
        size: "1.2 MB"
      },
      {
        id: "2-5",
        title: "Market Basics Workbook",
        type: "pdf",
        size: "2.5 MB"
      }
    ]
  },
  {
    id: "module-3",
    number: 3,
    title: "Strategy",
    description: "Learn proven trading strategies and techniques",
    lessons: [
      {
        id: "3-1",
        title: "Covered Calls Strategy",
        type: "video",
        duration: "22 min"
      },
      {
        id: "3-2",
        title: "Protective Puts",
        type: "video",
        duration: "18 min"
      },
      {
        id: "3-3",
        title: "Spreads and Combinations",
        type: "video",
        duration: "30 min"
      },
      {
        id: "3-4",
        title: "Strategy Selection Framework",
        type: "pdf",
        size: "3.1 MB"
      },
      {
        id: "3-5",
        title: "Advanced Strategies Guide",
        type: "pdf",
        size: "4.2 MB"
      }
    ]
  },
  {
    id: "module-4",
    number: 4,
    title: "Tools",
    description: "Master the tools and platforms for successful trading",
    lessons: [
      {
        id: "4-1",
        title: "Trading Platform Setup",
        type: "video",
        duration: "16 min"
      },
      {
        id: "4-2",
        title: "Chart Analysis Tools",
        type: "video",
        duration: "24 min"
      },
      {
        id: "4-3",
        title: "Options Calculator Usage",
        type: "video",
        duration: "14 min"
      },
      {
        id: "4-4",
        title: "Trading Plan Template",
        type: "pdf",
        size: "850 KB"
      },
      {
        id: "4-5",
        title: "Risk Management Spreadsheet",
        type: "pdf",
        size: "1.8 MB"
      }
    ]
  },
  {
    id: "module-5",
    number: 5,
    title: "Tutorials",
    description: "Step-by-step guides for real trading scenarios",
    lessons: [
      {
        id: "5-1",
        title: "Placing Your First Trade",
        type: "video",
        duration: "20 min"
      },
      {
        id: "5-2",
        title: "Reading Market Data",
        type: "video",
        duration: "18 min"
      },
      {
        id: "5-3",
        title: "Managing Open Positions",
        type: "video",
        duration: "22 min"
      },
      {
        id: "5-4",
        title: "Closing and Rolling Trades",
        type: "video",
        duration: "16 min"
      }
    ]
  },
  {
    id: "module-6",
    number: 6,
    title: "Resources",
    description: "Additional materials and reference guides",
    lessons: [
      {
        id: "6-1",
        title: "Market Analysis Techniques",
        type: "video",
        duration: "28 min"
      },
      {
        id: "6-2",
        title: "Advanced Chart Patterns",
        type: "video",
        duration: "26 min"
      },
      {
        id: "6-3",
        title: "Risk Management Handbook",
        type: "pdf",
        size: "5.1 MB"
      },
      {
        id: "6-4",
        title: "Technical Indicators Guide",
        type: "pdf",
        size: "3.8 MB"
      },
      {
        id: "6-5",
        title: "Options Trading Cheat Sheet",
        type: "pdf",
        size: "1.5 MB"
      }
    ]
  }
]

async function migrateAcademyContent() {
  console.log("================================================================================")
  console.log("📚 ACADEMY CONTENT MIGRATION")
  console.log("================================================================================\n")

  console.log(`📊 Migration Summary:`)
  console.log(`   - Modules to migrate: ${hardcodedModules.length}`)
  console.log(`   - Total lessons: ${hardcodedModules.reduce((acc, m) => acc + m.lessons.length, 0)}`)
  console.log()

  // Check for existing data
  const { data: existingModules } = await supabase
    .from("academy_modules")
    .select("number")

  if (existingModules && existingModules.length > 0) {
    console.log("⚠️  WARNING: Database already contains modules!")
    console.log(`   Found ${existingModules.length} existing modules`)
    console.log()
    console.log("   This script will skip existing modules and only add new ones.")
    console.log()
  }

  let modulesCreated = 0
  let lessonsCreated = 0
  let modulesSkipped = 0
  let errors = 0

  for (const moduleData of hardcodedModules) {
    console.log(`\n${"=".repeat(80)}`)
    console.log(`📖 MODULE ${moduleData.number}: ${moduleData.title}`)
    console.log("=".repeat(80))

    // Check if module already exists
    const { data: existingModule } = await supabase
      .from("academy_modules")
      .select("id")
      .eq("number", moduleData.number)
      .single()

    let moduleId: string

    if (existingModule) {
      console.log(`   ⏭️  Module ${moduleData.number} already exists, skipping creation`)
      moduleId = existingModule.id
      modulesSkipped++
    } else {
      // Insert module
      const { data: newModule, error: moduleError } = await supabase
        .from("academy_modules")
        .insert({
          number: moduleData.number,
          title: moduleData.title,
          description: moduleData.description,
          display_order: moduleData.number,
          is_published: true
        })
        .select("id")
        .single()

      if (moduleError) {
        console.error(`   ❌ Error creating module: ${moduleError.message}`)
        errors++
        continue
      }

      moduleId = newModule.id
      modulesCreated++
      console.log(`   ✅ Module created successfully`)
    }

    // Insert lessons
    console.log(`   \n   📝 Migrating ${moduleData.lessons.length} lessons:`)

    for (const lesson of moduleData.lessons) {
      // Check if lesson already exists
      const { data: existingLesson } = await supabase
        .from("academy_lessons")
        .select("id")
        .eq("lesson_id", lesson.id)
        .single()

      if (existingLesson) {
        console.log(`      ⏭️  Lesson ${lesson.id} already exists, skipping`)
        continue
      }

      const { error: lessonError } = await supabase
        .from("academy_lessons")
        .insert({
          lesson_id: lesson.id,
          module_id: moduleId,
          title: lesson.title,
          type: lesson.type,
          video_url: lesson.type === "video" ? lesson.url || null : null,
          pdf_url: lesson.type === "pdf" ? lesson.url || null : null,
          duration: lesson.duration || null,
          file_size: lesson.size || null,
          is_published: true
        })

      if (lessonError) {
        console.error(`      ❌ Error creating lesson ${lesson.id}: ${lessonError.message}`)
        errors++
      } else {
        lessonsCreated++
        console.log(`      ✅ ${lesson.id}: ${lesson.title} (${lesson.type})`)
      }
    }
  }

  console.log("\n" + "=".repeat(80))
  console.log("📊 MIGRATION COMPLETE")
  console.log("=".repeat(80))
  console.log()
  console.log(`✅ Modules created: ${modulesCreated}`)
  console.log(`⏭️  Modules skipped: ${modulesSkipped}`)
  console.log(`✅ Lessons created: ${lessonsCreated}`)
  if (errors > 0) {
    console.log(`❌ Errors: ${errors}`)
  }
  console.log()

  if (errors === 0) {
    console.log("🎉 All content migrated successfully!")
  } else {
    console.log("⚠️  Migration completed with errors. Please review the output above.")
  }
  console.log()
}

// Run migration
migrateAcademyContent()
  .then(() => {
    console.log("Migration script finished.")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
