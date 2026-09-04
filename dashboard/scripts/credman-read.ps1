# Canonical get-token.ps1 - copy to scripts/get-token.ps1 in any project.
# Reads BWS_ACCESS_TOKEN from Windows Credential Manager via P/Invoke.
# Prints the token to stdout. The token is decrypted in-process only — never written to disk.

Add-Type @"
using System;
using System.Runtime.InteropServices;

public class CredMan {
    [DllImport("Advapi32.dll", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);

    [DllImport("Advapi32.dll", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern void CredFree(IntPtr cred);

    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public struct CREDENTIAL {
        public uint Flags;
        public uint Type;
        public IntPtr TargetName;
        public IntPtr Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        public IntPtr TargetAlias;
        public IntPtr UserName;
    }

    public static string GetSecret(string target) {
        IntPtr credPtr;
        if (!CredRead(target, 1, 0, out credPtr)) return null;
        try {
            CREDENTIAL c = (CREDENTIAL)Marshal.PtrToStructure(credPtr, typeof(CREDENTIAL));
            return Marshal.PtrToStringUni(c.CredentialBlob, (int)(c.CredentialBlobSize / 2));
        } finally {
            CredFree(credPtr);
        }
    }
}
"@

$token = [CredMan]::GetSecret("BWS_ACCESS_TOKEN")
if (-not $token) {
    [Console]::Error.WriteLine("ERROR: BWS_ACCESS_TOKEN not found in Windows Credential Manager.")
    [Console]::Error.WriteLine("Re-run save-bws-token.ps1 to store it.")
    exit 1
}
Write-Output $token
