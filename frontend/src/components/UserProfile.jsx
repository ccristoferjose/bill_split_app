// frontend/src/components/UserProfile.jsx
import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useGetUserProfileQuery, useUpdateUserProfileMutation } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, Mail, Lock, Save, X, Edit, CheckCircle, AlertCircle } from 'lucide-react';

const UserProfile = ({ userId }) => {
  const { user: authUser } = useSelector((state) => state.auth);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // Fetch user profile
  const { 
    data: profile, 
    isLoading, 
    error: fetchError,
    refetch 
  } = useGetUserProfileQuery(userId);

  // Update profile mutation
  const [
    updateProfile, 
    { 
      isLoading: isUpdating, 
      isSuccess: updateSuccess,
      isError: updateError,
      error: updateErrorDetails,
      reset: resetUpdateState
    }
  ] = useUpdateUserProfileMutation();

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || '',
        email: profile.email || '',
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        phone: profile.phone || '',
      });
    }
  }, [profile]);

  // Auto-hide success message
  useEffect(() => {
    if (updateSuccess) {
      const timer = setTimeout(() => {
        resetUpdateState();
        setIsEditing(false);
        setShowPasswordSection(false);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [updateSuccess, resetUpdateState]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate passwords if changing
    if (showPasswordSection) {
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        alert('New passwords do not match!');
        return;
      }
      if (passwordData.newPassword && passwordData.newPassword.length < 6) {
        alert('Password must be at least 6 characters long!');
        return;
      }
    }

    try {
      const updateData = {
        userId,
        username: formData.username,
        email: formData.email,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
      };

      // Add password fields if changing password
      if (showPasswordSection && passwordData.newPassword) {
        updateData.current_password = passwordData.currentPassword;
        updateData.new_password = passwordData.newPassword;
      }

      await updateProfile(updateData).unwrap();
      refetch();
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setShowPasswordSection(false);
    resetUpdateState();
    // Reset form to original values
    if (profile) {
      setFormData({
        username: profile.username || '',
        email: profile.email || '',
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        phone: profile.phone || '',
      });
    }
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading profile...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (fetchError) {
    return (
      <Card>
        <CardContent className="py-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load profile. Please try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Information Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Manage your account details and preferences
              </CardDescription>
            </div>
            {!isEditing && (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                size="sm"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Success Message */}
          {updateSuccess && (
            <Alert className="mb-6 bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Profile updated successfully!
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {updateError && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {updateErrorDetails?.data?.message || 'Failed to update profile. Please try again.'}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username */}
            <div className="grid gap-2">
              <Label htmlFor="username" className="flex items-center">
                <User className="h-4 w-4 mr-2 text-gray-500" />
                Username
              </Label>
              {isEditing ? (
                <Input
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter username"
                  required
                />
              ) : (
                <p className="text-sm font-medium py-2 px-3 bg-gray-50 rounded-md">
                  {profile?.username || 'Not set'}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email" className="flex items-center">
                <Mail className="h-4 w-4 mr-2 text-gray-500" />
                Email Address
              </Label>
              {isEditing ? (
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter email"
                  required
                />
              ) : (
                <p className="text-sm font-medium py-2 px-3 bg-gray-50 rounded-md">
                  {profile?.email || 'Not set'}
                </p>
              )}
            </div>

            {/* First Name */}
            <div className="grid gap-2">
              <Label htmlFor="firstName">First Name</Label>
              {isEditing ? (
                <Input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="Enter first name"
                />
              ) : (
                <p className="text-sm font-medium py-2 px-3 bg-gray-50 rounded-md">
                  {profile?.first_name || 'Not set'}
                </p>
              )}
            </div>

            {/* Last Name */}
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last Name</Label>
              {isEditing ? (
                <Input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Enter last name"
                />
              ) : (
                <p className="text-sm font-medium py-2 px-3 bg-gray-50 rounded-md">
                  {profile?.last_name || 'Not set'}
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number</Label>
              {isEditing ? (
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Enter phone number"
                />
              ) : (
                <p className="text-sm font-medium py-2 px-3 bg-gray-50 rounded-md">
                  {profile?.phone || 'Not set'}
                </p>
              )}
            </div>

            {/* Change Password Section */}
            {isEditing && (
              <div className="pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPasswordSection(!showPasswordSection)}
                  className="mb-4"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  {showPasswordSection ? 'Cancel Password Change' : 'Change Password'}
                </Button>

                {showPasswordSection && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-md">
                    <div className="grid gap-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        name="currentPassword"
                        type="password"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange}
                        placeholder="Enter current password"
                        required={showPasswordSection}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        placeholder="Enter new password (min 6 characters)"
                        minLength={6}
                        required={showPasswordSection}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        placeholder="Confirm new password"
                        required={showPasswordSection}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {isEditing && (
              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={isUpdating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isUpdating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isUpdating}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Account Statistics Card */}
      <Card>
        <CardHeader>
          <CardTitle>Account Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Account Created</p>
              <p className="text-lg font-semibold text-blue-700">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">User ID</p>
              <p className="text-lg font-semibold text-green-700">
                #{profile?.id || userId}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserProfile;