#!/usr/bin/env node

import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv(file = '.env.local') {
    if (!fs.existsSync(file)) return
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^([^#=]+)=(.*)$/)
        if (!match) continue
        const key = match[1].trim()
        const value = match[2].trim().replace(/^['"]|['"]$/g, '')
        if (!process.env[key]) process.env[key] = value
    }
}

async function check() {
    loadEnv()
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase nao configurado em .env.local.')
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const requiredPropertyColumns = [
        'source_system',
        'source_reference',
        'source_slug',
        'source_status',
        'purpose',
        'suites',
        'parking_spaces',
        'neighborhood',
        'street',
        'area_private_m2',
        'source_payload',
        'imported_at',
    ]
    const requiredTables = [
        'property_media',
        'property_private_details',
        'property_import_logs',
    ]

    const report = {
        ready: true,
        missing_property_columns: [],
        missing_tables: [],
    }

    const { data: propertiesSample, error: propertiesError } = await supabase
        .from('properties')
        .select('*')
        .limit(1)

    if (propertiesError) throw propertiesError

    const propertyColumns = new Set(Object.keys(propertiesSample?.[0] || {}))
    for (const column of requiredPropertyColumns) {
        if (!propertyColumns.has(column)) report.missing_property_columns.push(column)
    }

    for (const table of requiredTables) {
        const { error } = await supabase.from(table).select('id').limit(1)
        if (error) report.missing_tables.push(table)
    }

    report.ready = report.missing_property_columns.length === 0 && report.missing_tables.length === 0
    console.log(JSON.stringify(report, null, 2))

    if (!report.ready) {
        console.log('\nAplique a SQL: supabase/migrations/20260502170000_property_xml_import_foundation.sql')
        process.exit(1)
    }
}

check().catch(error => {
    console.error(error?.message || error)
    process.exit(1)
})
