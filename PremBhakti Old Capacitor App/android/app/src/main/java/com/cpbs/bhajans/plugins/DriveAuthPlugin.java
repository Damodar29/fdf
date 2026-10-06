package com.cpbs.bhajans.plugins;

import android.accounts.Account;
import android.app.Activity;
import android.app.PendingIntent;
import android.util.Log;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;
import java.util.ArrayList;
import java.util.List;

/**
 * Gets a Google Drive access token for the backup, without signing in again.
 *
 * The sign-in plugin can only fetch Drive access as part of a full Google
 * sign-in (account picker every time), and when access was already granted it
 * returns no token at all — so every Drive backup after the first one failed.
 * This asks Google's Authorization API for the Drive scope alone: silent once
 * granted, Google's consent screen only the first time.
 *
 * JS: utils/backup/driveBackup.ts → DriveAuth.authorize({ scopes, interactive, email })
 */
@CapacitorPlugin(name = "DriveAuth")
public class DriveAuthPlugin extends Plugin {
    private static final String TAG = "DriveAuthPlugin";

    private ActivityResultLauncher<IntentSenderRequest> consentLauncher;
    private PluginCall pendingCall;

    @Override
    public void load() {
        // Registered while the activity is still being created, as required.
        consentLauncher = getActivity().registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(),
            result -> {
                PluginCall call = pendingCall;
                pendingCall = null;
                if (call == null) return;
                if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
                    call.reject("The user cancelled Drive permission.", "CANCELLED");
                    return;
                }
                try {
                    AuthorizationResult authResult = Identity
                        .getAuthorizationClient(getContext())
                        .getAuthorizationResultFromIntent(result.getData());
                    resolveWithToken(call, authResult);
                } catch (ApiException e) {
                    call.reject("Drive permission failed: " + e.getMessage(), "FAILED");
                }
            }
        );
    }

    @PluginMethod
    public void authorize(PluginCall call) {
        JSArray scopeArray = call.getArray("scopes");
        boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", true));
        String email = call.getString("email");

        List<Scope> scopes = new ArrayList<>();
        try {
            if (scopeArray != null) {
                for (Object value : scopeArray.toList()) {
                    if (value instanceof String) scopes.add(new Scope((String) value));
                }
            }
        } catch (Exception e) {
            call.reject("Invalid scopes", "INVALID");
            return;
        }
        if (scopes.isEmpty()) {
            call.reject("No scopes requested", "INVALID");
            return;
        }

        AuthorizationRequest.Builder builder = AuthorizationRequest.builder().setRequestedScopes(scopes);
        // The Google account the devotee logged in with, so Google doesn't ask which one.
        if (email != null && !email.isEmpty()) {
            builder.setAccount(new Account(email, "com.google"));
        }

        Identity.getAuthorizationClient(getActivity())
            .authorize(builder.build())
            .addOnSuccessListener(authResult -> {
                if (!authResult.hasResolution()) {
                    resolveWithToken(call, authResult);
                    return;
                }
                if (!interactive) {
                    // The automatic backup never shows anything.
                    call.reject("Drive permission has not been granted yet.", "NEEDS_CONSENT");
                    return;
                }
                PendingIntent intent = authResult.getPendingIntent();
                if (intent == null) {
                    call.reject("No consent screen available.", "FAILED");
                    return;
                }
                if (pendingCall != null) {
                    pendingCall.reject("Superseded by a newer request.", "CANCELLED");
                }
                pendingCall = call;
                try {
                    consentLauncher.launch(new IntentSenderRequest.Builder(intent.getIntentSender()).build());
                } catch (Exception e) {
                    pendingCall = null;
                    call.reject("Could not open the consent screen: " + e.getMessage(), "FAILED");
                }
            })
            .addOnFailureListener(e -> {
                Log.w(TAG, "authorize failed", e);
                call.reject("Drive permission failed: " + e.getMessage(), "FAILED");
            });
    }

    private void resolveWithToken(PluginCall call, AuthorizationResult authResult) {
        String token = authResult.getAccessToken();
        if (token == null || token.isEmpty()) {
            call.reject("Google returned no access token.", "FAILED");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("accessToken", token);
        call.resolve(ret);
    }
}
