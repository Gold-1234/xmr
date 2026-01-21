import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  email: string;
  password: string;
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

    const { email, password }: RequestBody = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const passwordHash = btoa(password);

    let userId: string;
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      const { data: userCheck } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .eq('password_hash', passwordHash)
        .maybeSingle();

      if (!userCheck) {
        return new Response(
          JSON.stringify({ error: 'Invalid credentials' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      userId = userCheck.id;
    } else {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({ email, password_hash: passwordHash })
        .select('id')
        .single();

      if (createError || !newUser) {
        return new Response(
          JSON.stringify({ error: 'Failed to create user' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      userId = newUser.id;
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error: otpError } = await supabase.from('otp_codes').insert({
      user_id: userId,
      email,
      code: otpCode,
      expires_at: expiresAt,
      verified: false,
    });

    if (otpError) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate OTP' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const emailContent = `
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h1 style="color: #2563eb; margin-bottom: 20px;">Medical Report Analyzer</h1>
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hello,</p>
          <p style="font-size: 16px; color: #333; margin-bottom: 30px;">Your verification code is:</p>
          <div style="background-color: #f0f9ff; border: 2px solid #2563eb; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 30px;">
            <p style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 5px; margin: 0;">${otpCode}</p>
          </div>
          <p style="font-size: 14px; color: #666; margin-bottom: 20px;">This code will expire in 5 minutes. Do not share this code with anyone.</p>
          <p style="font-size: 14px; color: #666; margin-bottom: 20px;">If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">Medical Report Analyzer - Secure Authentication</p>
        </div>
      </body>
    </html>
    `;

    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'Medical Report Analyzer <onboarding@resend.dev>',
            to: email,
            subject: 'Your OTP Code - Medical Report Analyzer',
            html: emailContent,
          }),
        });

        if (!emailResponse.ok) {
          console.error('Email service failed, but OTP was generated');
        }
      } else {
        console.log(`OTP for ${email}: ${otpCode}`);
      }
    } catch (emailError) {
      console.error('Error sending email:', emailError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'OTP generated successfully',
        userId,
        otpCode,
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