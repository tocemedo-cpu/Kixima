import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ProfileService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('profile() chama GET /api/users/profile', () => {
    service.profile().subscribe();
    const req = http.expectOne('/api/users/profile');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('uploadAvatar() chama POST /api/users/me/avatar com o campo "image"', () => {
    const file = new File(['x'], 'foto.png', { type: 'image/png' });
    service.uploadAvatar(file).subscribe();
    const req = http.expectOne('/api/users/me/avatar');
    expect(req.request.method).toBe('POST');
    const fd = req.request.body as FormData;
    expect(fd.get('image')).toBe(file);
    req.flush({});
  });

  it('removeAvatar() chama DELETE /api/users/me/avatar', () => {
    service.removeAvatar().subscribe();
    const req = http.expectOne('/api/users/me/avatar');
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
