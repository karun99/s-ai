import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NeuralMap, getNeuralMap } from '../dist/src/neural/index.js';

describe('NeuralMap', () => {
  it('should create a NeuralMap instance', () => {
    const nm = new NeuralMap();
    assert.ok(nm);
    assert.equal(nm.isEnabled(), true);
  });

  it('should return null when no profile is set', () => {
    const nm = new NeuralMap();
    const profile = nm.getProfile();
    assert.equal(profile, null);
  });

  it('should set and get a persona profile', () => {
    const nm = new NeuralMap({ persistAcrossSessions: false });
    const profile = nm.setProfile({
      name: 'Test User',
      bio: 'A test persona'
    });
    assert.equal(profile.name, 'Test User');
    assert.equal(profile.bio, 'A test persona');
    assert.ok(profile.id);
    assert.ok(profile.createdAt);
    assert.ok(profile.updatedAt);
    const got = nm.getProfile();
    assert.equal(got.name, 'Test User');
  });

  it('should update an existing profile', () => {
    const nm = new NeuralMap({ persistAcrossSessions: false });
    nm.setProfile({ name: 'Original', bio: 'old' });
    const updated = nm.setProfile({ name: 'Updated', bio: 'new' });
    assert.equal(updated.name, 'Updated');
    assert.equal(updated.bio, 'new');
  });

  it('should clear profile', () => {
    const nm = new NeuralMap({ persistAcrossSessions: false });
    nm.setProfile({ name: 'To Clear' });
    assert.ok(nm.getProfile());
    nm.clearProfile();
    assert.equal(nm.getProfile(), null);
  });

  it('should build persona context string', () => {
    const nm = new NeuralMap({ persistAcrossSessions: false });
    nm.setProfile({
      name: 'Alice',
      bio: 'Senior engineer',
      worldview: 'Pragmatism',
      coreBeliefs: ['Simplicity', 'Clarity'],
      communicationStyle: {
        formality: 0.7,
        verbosity: 0.4,
        technicality: 0.8,
        emotionalExpressiveness: 0.3,
        preferredTone: 'professional'
      }
    });
    const ctx = nm.buildPersonaContext();
    assert.ok(ctx.includes('Alice'));
    assert.ok(ctx.includes('Senior engineer'));
    assert.ok(ctx.includes('Pragmatism'));
    assert.ok(ctx.includes('Simplicity'));
    assert.ok(ctx.includes('professional'));
  });

  it('should build system prompt directive', () => {
    const nm = new NeuralMap({ persistAcrossSessions: false });
    nm.setProfile({ name: 'Bob', bio: 'Developer' });
    const directive = nm.buildSystemPromptDirective();
    assert.ok(directive.includes('PERSONA ADAPTATION MODULE'));
    assert.ok(directive.includes('Bob'));
  });

  it('should add and remove context nodes', () => {
    const nm = new NeuralMap({ persistAcrossSessions: false });
    nm.setProfile({ name: 'Node User' });
    const node = nm.addContextNode({ type: 'link', title: 'Test Link', content: 'https://example.com' });
    assert.equal(node.type, 'link');
    assert.equal(node.title, 'Test Link');
    assert.ok(node.id);
    const profile = nm.getProfile();
    assert.equal(profile.contextNodes.length, 1);

    const removed = nm.removeContextNode(node.id);
    assert.equal(removed, true);
    assert.equal(nm.getProfile().contextNodes.length, 0);
  });

  it('should analyze sentiment', () => {
    const nm = new NeuralMap();
    assert.equal(nm.analyzeSentiment('I love this amazing feature'), 'positive');
    assert.equal(nm.analyzeSentiment('This is terrible and awful'), 'negative');
    assert.equal(nm.analyzeSentiment('The weather is cloudy'), 'neutral');
  });

  it('should add interaction history', () => {
    const nm = new NeuralMap({ persistAcrossSessions: false });
    nm.setProfile({ name: 'History User' });
    nm.addInteraction('Hello', 'Hi there', 'positive');
    const profile = nm.getProfile();
    assert.equal(profile.interactionHistory.length, 1);
    assert.equal(profile.interactionHistory[0].sentiment, 'positive');
  });

  it('should return empty context when no profile', () => {
    const nm = new NeuralMap({ persistAcrossSessions: false });
    assert.equal(nm.buildPersonaContext(), '');
    assert.equal(nm.buildSystemPromptDirective(), '');
  });

  it('should get singleton via getNeuralMap', () => {
    const nm1 = getNeuralMap();
    const nm2 = getNeuralMap();
    assert.equal(nm1, nm2);
  });
});
