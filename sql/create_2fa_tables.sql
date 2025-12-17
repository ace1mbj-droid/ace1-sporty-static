-- Create table for storing user 2FA codes sent via email
CREATE TABLE IF NOT EXISTS user_2fa_codes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_2fa_codes_user_id ON user_2fa_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_2fa_codes_expires_at ON user_2fa_codes(expires_at);

-- Enable RLS
ALTER TABLE user_2fa_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can insert/read/update
CREATE POLICY "Service role can manage 2FA codes" ON user_2fa_codes
  USING (TRUE)
  WITH CHECK (TRUE)
  FOR ALL;

-- Create table for tracking user 2FA preferences
CREATE TABLE IF NOT EXISTS user_2fa_settings (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_type TEXT DEFAULT 'email', -- 'email' or 'totp'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for user lookup
CREATE INDEX IF NOT EXISTS idx_user_2fa_settings_user_id ON user_2fa_settings(user_id);

-- Enable RLS
ALTER TABLE user_2fa_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage settings
CREATE POLICY "Service role can manage 2FA settings" ON user_2fa_settings
  USING (TRUE)
  WITH CHECK (TRUE)
  FOR ALL;
