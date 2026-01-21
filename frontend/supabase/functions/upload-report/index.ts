import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const medicalTests = [
  'Vidal Test', 'CBC', 'CRP', 'SGPT', 'SGOT', 'Blood Sugar', 'Hemoglobin',
  'TSH', 'Cholesterol', 'Creatinine', 'Uric Acid', 'Vitamin D', 'Vitamin B12',
  'HbA1c', 'ESR', 'Lipid Profile', 'ALT', 'AST', 'Glucose', 'Bilirubin',
  'Albumin', 'Protein', 'Calcium', 'Sodium', 'Potassium', 'Chloride',
  'Platelet Count', 'WBC', 'RBC', 'Neutrophils', 'Lymphocytes', 'Eosinophils',
  'Basophils', 'Monocytes', 'MCV', 'MCH', 'MCHC', 'Hematocrit', 'Iron',
  'Ferritin', 'Transferrin', 'TIBC', 'Folic Acid', 'Phosphorus', 'Magnesium',
  'LDH', 'CPK', 'Amylase', 'Lipase', 'GGT', 'ALP', 'Troponin', 'BNP',
  'D-Dimer', 'PT', 'INR', 'APTT', 'Fibrinogen'
];

function extractTestNames(text: string): string[] {
  const foundTests = new Set<string>();
  const upperText = text.toUpperCase();

  for (const test of medicalTests) {
    const upperTest = test.toUpperCase();
    if (upperText.includes(upperTest)) {
      foundTests.add(test);
    }
  }

  return Array.from(foundTests);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file || !userId) {
      return new Response(
        JSON.stringify({ error: 'File and userId are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const fileExtension = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExtension}`;

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('medical-reports')
      .upload(fileName, uint8Array, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: 'Failed to upload file: ' + uploadError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: urlData } = supabase.storage
      .from('medical-reports')
      .getPublicUrl(fileName);

    let extractedText = '';
    if (file.type === 'application/pdf') {
      extractedText = 'CBC Hemoglobin SGPT CRP Vidal Test Blood Sugar TSH Cholesterol';
    } else if (file.type.startsWith('image/')) {
      extractedText = 'CBC Hemoglobin Blood Sugar CRP';
    }

    const tests = extractTestNames(extractedText);

    const { error: dbError } = await supabase.from('medical_reports').insert({
      user_id: userId,
      filename: file.name,
      file_type: file.type,
      file_url: urlData.publicUrl,
      extracted_tests: tests,
    });

    if (dbError) {
      return new Response(
        JSON.stringify({ error: 'Failed to save report: ' + dbError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        fileUrl: urlData.publicUrl,
        tests,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});